import { vi } from 'vitest'
import type { DataAdapter } from '@/lib/data-adapter'

/**
 * Creates a fully mocked DataAdapter where every method is a vi.fn()
 * returning sensible defaults (empty arrays for lists, null for single lookups).
 *
 * Mutation methods (create*, update*, save*) resolve to empty objects by default -- override these when your test depends on the returned entity shape.
 *
 * Pass overrides to customize specific method implementations.
 */
export function createMockAdapter(
  overrides?: Partial<{ [K in keyof DataAdapter]: DataAdapter[K] }>,
): DataAdapter {
  const base: DataAdapter = {
    // Exercise operations
    getExercises: vi.fn().mockResolvedValue([]),
    getExercise: vi.fn().mockResolvedValue(null),
    createExercise: vi.fn().mockResolvedValue({}),

    // Workout log operations
    getWorkoutLogs: vi.fn().mockResolvedValue([]),
    getWorkoutLogsSummary: vi.fn().mockResolvedValue([]),
    getWorkoutLog: vi.fn().mockResolvedValue(null),
    getWorkoutLogFull: vi.fn().mockResolvedValue(null),
    createWorkoutLog: vi.fn().mockResolvedValue({}),
    updateWorkoutLog: vi.fn().mockResolvedValue({}),
    deleteWorkoutLog: vi.fn().mockResolvedValue(undefined),
    createLoggedActivityGroup: vi.fn().mockResolvedValue({}),
    createLoggedActivity: vi.fn().mockResolvedValue({}),
    createLoggedSet: vi.fn().mockResolvedValue({}),
    updateLoggedSet: vi.fn().mockResolvedValue({}),

    // Exercise history operations
    getOneRepMaxHistory: vi.fn().mockResolvedValue([]),
    getRecentlyUsedExerciseIds: vi.fn().mockResolvedValue([]),
    getExerciseWorkoutHistory: vi.fn().mockResolvedValue([]),

    // User profile operations
    getUserProfile: vi.fn().mockResolvedValue(null),
    updateUserProfile: vi.fn().mockResolvedValue({}),
    saveOneRepMax: vi.fn().mockResolvedValue({}),

    // Session template operations
    getSessionTemplates: vi.fn().mockResolvedValue([]),
    getSessionTemplate: vi.fn().mockResolvedValue(null),
    getSessionTemplateFull: vi.fn().mockResolvedValue(null),
    createSessionTemplateFull: vi.fn().mockResolvedValue({}),
    updateSessionTemplateFull: vi.fn().mockResolvedValue({}),
    deleteSessionTemplate: vi.fn().mockResolvedValue(undefined),
    cloneSessionTemplate: vi.fn().mockResolvedValue({}),
    touchSessionTemplateLastAssigned: vi.fn().mockResolvedValue(undefined),

    // Event item operations
    getEventItems: vi.fn().mockResolvedValue([]),
    saveEventItem: vi.fn().mockResolvedValue({}),
    updateEventItem: vi.fn().mockResolvedValue({}),
    deleteEventItem: vi.fn().mockResolvedValue(undefined),
    toggleEventItemPacked: vi.fn().mockResolvedValue({}),
    reorderEventItems: vi.fn().mockResolvedValue(undefined),

    // Program operations
    getPrograms: vi.fn().mockResolvedValue([]),
    getProgramFull: vi.fn().mockResolvedValue(null),
    createProgramFull: vi.fn().mockResolvedValue({}),
    updateProgramFull: vi.fn().mockResolvedValue({}),
    deleteProgram: vi.fn().mockResolvedValue(undefined),
    assignProgramToMember: vi.fn().mockResolvedValue({}),

    // Program activation operations
    getActiveProgram: vi.fn().mockResolvedValue(null),
    setActiveProgram: vi.fn().mockResolvedValue({}),
    updateActiveProgram: vi.fn().mockResolvedValue({}),
    clearActiveProgram: vi.fn().mockResolvedValue(undefined),

    // Week status operations
    getWeekStatuses: vi.fn().mockResolvedValue([]),
    upsertWeekStatuses: vi.fn().mockResolvedValue([]),

    // Share link operations
    getShareLinks: vi.fn().mockResolvedValue([]),
    getShareLinksForEntity: vi.fn().mockResolvedValue([]),
    createShareLink: vi.fn().mockResolvedValue({}),
    revokeShareLink: vi.fn().mockResolvedValue(undefined),
    deleteShareLink: vi.fn().mockResolvedValue(undefined),

    // Analytics operations
    getWeeklyVolume: vi.fn().mockResolvedValue([]),
    getVaultSummary: vi.fn().mockResolvedValue({
      totalWorkouts: 0,
      totalVolumeLb: 0,
      thisWeekWorkouts: 0,
      thisWeekVolumeLb: 0,
    }),

    // Accountability Group operations
    createGroup: vi.fn().mockResolvedValue({}),
    getGroups: vi.fn().mockResolvedValue([]),
    getGroup: vi.fn().mockResolvedValue(null),
    updateGroup: vi.fn().mockResolvedValue({}),
    deleteGroup: vi.fn().mockResolvedValue(undefined),

    // Group Member operations
    getGroupMembers: vi.fn().mockResolvedValue([]),
    removeGroupMember: vi.fn().mockResolvedValue(undefined),
    updateMemberRole: vi.fn().mockResolvedValue({}),

    // Group Invite operations
    createInvite: vi.fn().mockResolvedValue({}),
    getGroupInvites: vi.fn().mockResolvedValue([]),
    revokeInvite: vi.fn().mockResolvedValue(undefined),
    joinGroupByCode: vi.fn().mockResolvedValue({}),

    // Direct Connection operations
    requestConnection: vi.fn().mockResolvedValue({}),
    getConnections: vi.fn().mockResolvedValue([]),
    getPendingConnections: vi.fn().mockResolvedValue([]),
    acceptConnection: vi.fn().mockResolvedValue({}),
    declineConnection: vi.fn().mockResolvedValue({}),
    removeConnection: vi.fn().mockResolvedValue(undefined),
    updateConnectionWriteAccess: vi.fn().mockResolvedValue({}),

    // Activity Feed operations
    getGroupActivityFeed: vi.fn().mockResolvedValue([]),
    getConnectionActivityFeed: vi.fn().mockResolvedValue([]),

    // Chat operations
    createConversation: vi.fn().mockResolvedValue({}),
    getConversations: vi.fn().mockResolvedValue([]),
    getConversation: vi.fn().mockResolvedValue(null),
    findDirectConversation: vi.fn().mockResolvedValue(null),
    sendMessage: vi.fn().mockResolvedValue({}),
    getMessages: vi.fn().mockResolvedValue([]),
    getMessagesSince: vi.fn().mockResolvedValue([]),
    updateLastRead: vi.fn().mockResolvedValue(undefined),
    getUnreadCounts: vi.fn().mockResolvedValue(new Map()),
    addParticipant: vi.fn().mockResolvedValue({}),
    leaveConversation: vi.fn().mockResolvedValue(undefined),
    toggleArchive: vi.fn().mockResolvedValue(undefined),
    saveMediaAttachment: vi.fn().mockResolvedValue({}),
    getMediaAttachments: vi.fn().mockResolvedValue([]),
    updateMediaAttachment: vi.fn().mockResolvedValue({}),

    // Publish / unpublish operations
    publishProgram: vi.fn().mockResolvedValue(undefined),
    publishSessionTemplate: vi.fn().mockResolvedValue(undefined),
    publishExercise: vi.fn().mockResolvedValue(undefined),
    unpublishProgram: vi.fn().mockResolvedValue(undefined),
    unpublishSessionTemplate: vi.fn().mockResolvedValue(undefined),
    unpublishExercise: vi.fn().mockResolvedValue(undefined),

    // Clone operations
    clonePublicSessionTemplate: vi.fn().mockResolvedValue('cloned-id'),
  }

  return { ...base, ...overrides }
}
