#!/usr/bin/env bash
set -euo pipefail

# Android on-device test runner using Maestro.
#
# Automatically starts an Android emulator if no device is connected.
# Creates an AVD on first run if none exists.
#
# Prerequisites:
#   1. Maestro CLI: curl -Ls "https://get.maestro.mobile.dev" | bash
#   2. Android SDK (emulator + platform-tools in PATH or ~/Android/Sdk)
#   3. Debug APK built: bun tauri android build --target aarch64 --debug
#
# Usage:
#   ./scripts/test-android.sh                     # Run all Maestro flows
#   ./scripts/test-android.sh --tag smoke         # Run only smoke-tagged flows
#   ./scripts/test-android.sh --flow app-launch.yaml  # Run a single flow
#   ./scripts/test-android.sh --skip-install      # Skip APK install step

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MAESTRO_DIR="$PROJECT_ROOT/maestro"

AVD_NAME="ardent_forge_test"
# Prefer the system image that's already downloaded locally
SYSTEM_IMAGE="system-images;android-36.1;google_apis_playstore;x86_64"
AVD_DEVICE="pixel_6"
EMULATOR_BOOT_TIMEOUT=180  # seconds

# Ensure the emulator can find AVDs created by avdmanager.
# avdmanager may write to ~/.config/.android/avd while the emulator
# looks in ~/.android/avd by default. Setting ANDROID_AVD_HOME resolves this.
for avd_dir in \
    "$HOME/.android/avd" \
    "$HOME/.config/.android/avd"; do
    if [ -d "$avd_dir" ]; then
        export ANDROID_AVD_HOME="$avd_dir"
        break
    fi
done

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# ---------------------------------------------------------------------------
# SDK discovery
# ---------------------------------------------------------------------------

find_sdk_binary() {
    local name="$1"
    # Already on PATH
    if command -v "$name" &>/dev/null; then
        echo "$name"
        return
    fi
    # Common install locations
    for dir in \
        "$HOME/Android/Sdk/emulator" \
        "$HOME/Android/Sdk/platform-tools" \
        "$HOME/Library/Android/sdk/emulator" \
        "$HOME/Library/Android/sdk/platform-tools" \
        "/opt/android-sdk/emulator" \
        "/opt/android-sdk/platform-tools"; do
        if [ -x "$dir/$name" ]; then
            echo "$dir/$name"
            return
        fi
    done
    echo ""
}

EMULATOR_BIN=$(find_sdk_binary "emulator")
ADB_BIN=$(find_sdk_binary "adb")
AVDMANAGER_BIN=$(find_sdk_binary "avdmanager")

# ---------------------------------------------------------------------------
# Prerequisites check
# ---------------------------------------------------------------------------

check_prerequisites() {
    if ! command -v maestro &>/dev/null; then
        echo -e "${RED}Error: Maestro CLI not found.${NC}"
        echo 'Install: curl -Ls "https://get.maestro.mobile.dev" | bash'
        exit 1
    fi

    if [ -z "$ADB_BIN" ]; then
        echo -e "${RED}Error: adb not found. Install Android SDK platform-tools.${NC}"
        exit 1
    fi

    if [ -z "$EMULATOR_BIN" ]; then
        echo -e "${RED}Error: emulator not found. Install Android SDK emulator package.${NC}"
        exit 1
    fi
}

# ---------------------------------------------------------------------------
# Emulator management
# ---------------------------------------------------------------------------

device_connected() {
    "$ADB_BIN" devices 2>/dev/null | grep -qc "device$" && return 0 || return 1
}

avd_exists() {
    "$EMULATOR_BIN" -list-avds 2>/dev/null | grep -qx "$AVD_NAME"
}

create_avd() {
    if [ -z "$AVDMANAGER_BIN" ]; then
        # Try to find avdmanager in common SDK cmdline-tools paths
        for dir in \
            "$HOME/Android/Sdk/cmdline-tools/latest/bin" \
            "$HOME/Android/Sdk/cmdline-tools/bin" \
            "$HOME/Library/Android/sdk/cmdline-tools/latest/bin"; do
            if [ -x "$dir/avdmanager" ]; then
                AVDMANAGER_BIN="$dir/avdmanager"
                break
            fi
        done
    fi

    if [ -z "$AVDMANAGER_BIN" ]; then
        echo -e "${RED}Error: avdmanager not found. Cannot create AVD automatically.${NC}"
        echo "Create one manually: avdmanager create avd -n $AVD_NAME -k \"$SYSTEM_IMAGE\" -d $AVD_DEVICE"
        exit 1
    fi

    # Ensure AVD lands in a directory the emulator will find
    if [ -z "${ANDROID_AVD_HOME:-}" ]; then
        export ANDROID_AVD_HOME="$HOME/.android/avd"
        mkdir -p "$ANDROID_AVD_HOME"
    fi

    echo -e "${CYAN}Creating AVD '$AVD_NAME' in $ANDROID_AVD_HOME...${NC}"
    echo "no" | "$AVDMANAGER_BIN" create avd \
        --name "$AVD_NAME" \
        --package "$SYSTEM_IMAGE" \
        --device "$AVD_DEVICE" \
        --force 2>&1 | grep -v "^$" || true
    echo -e "${GREEN}AVD created.${NC}"
}

start_emulator() {
    echo -e "${CYAN}Starting emulator ($AVD_NAME)...${NC}"
    "$EMULATOR_BIN" \
        -avd "$AVD_NAME" \
        -no-audio \
        -no-boot-anim \
        -no-snapshot-load \
        -gpu swiftshader_indirect \
        &>/tmp/ardent-forge-emulator.log &
    EMULATOR_PID=$!

    echo -e "${CYAN}Waiting for emulator to boot (up to ${EMULATOR_BOOT_TIMEOUT}s)...${NC}"
    local elapsed=0
    until "$ADB_BIN" shell getprop sys.boot_completed 2>/dev/null | grep -q "1"; do
        sleep 3
        elapsed=$((elapsed + 3))
        if [ "$elapsed" -ge "$EMULATOR_BOOT_TIMEOUT" ]; then
            echo -e "${RED}Emulator did not boot within ${EMULATOR_BOOT_TIMEOUT}s.${NC}"
            echo "Check /tmp/ardent-forge-emulator.log for details."
            kill "$EMULATOR_PID" 2>/dev/null || true
            exit 1
        fi
        echo -n "."
    done
    echo ""
    echo -e "${GREEN}Emulator booted.${NC}"
}

ensure_emulator() {
    if device_connected; then
        local count
        count=$("$ADB_BIN" devices 2>/dev/null | grep -c "device$")
        echo -e "${GREEN}Found $count connected device(s).${NC}"
        return
    fi

    echo -e "${YELLOW}No device connected. Starting emulator...${NC}"

    if ! avd_exists; then
        create_avd
    fi

    start_emulator
    EMULATOR_STARTED=true
}

# ---------------------------------------------------------------------------
# APK install
# ---------------------------------------------------------------------------

install_apk() {
    local apk_path

    # Look for debug APK in this directory first, then the main repo root
    # (worktrees share the same build output via the main repo)
    local git_root
    git_root=$(git -C "$PROJECT_ROOT" rev-parse --show-superproject-working-tree 2>/dev/null)
    if [ -z "$git_root" ]; then
        git_root="$PROJECT_ROOT"
    fi

    for search_root in "$PROJECT_ROOT" "$git_root"; do
        apk_path=$(find "$search_root/src-tauri/gen/android/app/build/outputs" \
            -name "*.apk" -path "*/debug/*" 2>/dev/null | head -1)
        if [ -n "$apk_path" ]; then
            break
        fi
    done

    if [ -z "$apk_path" ]; then
        echo -e "${YELLOW}No debug APK found. Build one with:${NC}"
        echo "  bun tauri android build --debug"
        exit 1
    fi

    echo -e "${GREEN}Installing: $(basename "$apk_path")${NC}"
    "$ADB_BIN" install -r "$apk_path"
}

# ---------------------------------------------------------------------------
# Run Maestro
# ---------------------------------------------------------------------------

run_tests() {
    local tag=""
    local flow=""

    while [[ $# -gt 0 ]]; do
        case $1 in
            --tag)    tag="$2";  shift 2 ;;
            --flow)   flow="$2"; shift 2 ;;
            --skip-install) shift ;;
            *) echo "Unknown argument: $1"; exit 1 ;;
        esac
    done

    if [ -n "$flow" ]; then
        echo -e "${GREEN}Running flow: $flow${NC}"
        maestro test "$MAESTRO_DIR/$flow"
    elif [ -n "$tag" ]; then
        echo -e "${GREEN}Running flows tagged: $tag${NC}"
        maestro test --include-tags "$tag" "$MAESTRO_DIR"
    else
        echo -e "${GREEN}Running all flows${NC}"
        maestro test "$MAESTRO_DIR"
    fi
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

EMULATOR_STARTED=false

echo "================================================"
echo "  Ardent Forge - Android Test Runner"
echo "================================================"
echo ""

check_prerequisites
ensure_emulator

if [[ ! " $* " =~ " --skip-install " ]]; then
    install_apk
fi

run_tests "$@"

# Shut down the emulator we started (leave user's own devices alone)
if [ "$EMULATOR_STARTED" = true ]; then
    echo -e "${CYAN}Shutting down emulator...${NC}"
    "$ADB_BIN" emu kill 2>/dev/null || true
fi
