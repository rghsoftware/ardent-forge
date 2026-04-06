#!/usr/bin/env bash
set -euo pipefail

# Android on-device test runner using Maestro.
#
# Prerequisites:
#   1. Maestro CLI installed: curl -Ls "https://get.maestro.mobile.dev" | bash
#   2. Android emulator running or device connected (adb devices shows a target)
#   3. Debug APK built: bun tauri android build --target aarch64 --debug
#
# Usage:
#   ./scripts/test-android.sh                # Run all Maestro flows
#   ./scripts/test-android.sh --tag smoke    # Run only smoke-tagged flows
#   ./scripts/test-android.sh --flow app-launch.yaml  # Run a single flow

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MAESTRO_DIR="$PROJECT_ROOT/maestro"
APP_ID="com.rghsoftware.ardentforge"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check prerequisites
check_prerequisites() {
    if ! command -v maestro &> /dev/null; then
        echo -e "${RED}Error: Maestro CLI not found.${NC}"
        echo "Install: curl -Ls \"https://get.maestro.mobile.dev\" | bash"
        exit 1
    fi

    if ! command -v adb &> /dev/null; then
        echo -e "${RED}Error: adb not found. Install Android SDK platform-tools.${NC}"
        exit 1
    fi

    local device_count
    device_count=$(adb devices | grep -c "device$" || true)
    if [ "$device_count" -eq 0 ]; then
        echo -e "${RED}Error: No Android device/emulator connected.${NC}"
        echo "Start an emulator: emulator -avd <avd-name>"
        echo "Or connect a device via USB with developer mode enabled."
        exit 1
    fi

    echo -e "${GREEN}Found $device_count connected device(s)${NC}"
}

# Install APK if not already present
install_apk() {
    local apk_path
    apk_path=$(find "$PROJECT_ROOT/src-tauri/gen/android/app/build/outputs" \
        -name "*.apk" -path "*/debug/*" 2>/dev/null | head -1)

    if [ -z "$apk_path" ]; then
        echo -e "${YELLOW}No debug APK found. Build one with:${NC}"
        echo "  bun tauri android build --target aarch64 --debug"
        exit 1
    fi

    echo -e "${GREEN}Installing APK: $(basename "$apk_path")${NC}"
    adb install -r "$apk_path"
}

# Run Maestro flows
run_tests() {
    local tag=""
    local flow=""

    while [[ $# -gt 0 ]]; do
        case $1 in
            --tag)
                tag="$2"
                shift 2
                ;;
            --flow)
                flow="$2"
                shift 2
                ;;
            --skip-install)
                shift
                ;;
            *)
                echo "Unknown argument: $1"
                exit 1
                ;;
        esac
    done

    if [ -n "$flow" ]; then
        echo -e "${GREEN}Running single flow: $flow${NC}"
        maestro test "$MAESTRO_DIR/$flow"
    elif [ -n "$tag" ]; then
        echo -e "${GREEN}Running flows tagged: $tag${NC}"
        maestro test --include-tags "$tag" "$MAESTRO_DIR"
    else
        echo -e "${GREEN}Running all Maestro flows${NC}"
        maestro test "$MAESTRO_DIR"
    fi
}

# Main
echo "================================================"
echo "  Ardent Forge - Android Test Runner"
echo "================================================"
echo ""

check_prerequisites

# Skip install if --skip-install is passed
if [[ ! " $* " =~ " --skip-install " ]]; then
    install_apk
fi

run_tests "$@"
