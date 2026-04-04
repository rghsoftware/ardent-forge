import { Icon } from '@/components/icon'

// ---------------------------------------------------------------------------
// FileCard -- displays a downloadable file attachment in chat
// ---------------------------------------------------------------------------

interface FileCardProps {
  filename: string
  mimeType?: string
  fileSizeBytes?: number
  onDownload: () => void
}

function getFileIcon(mimeType?: string): string {
  if (!mimeType) return 'insert_drive_file'

  if (mimeType === 'application/pdf') return 'picture_as_pdf'
  if (
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )
    return 'description'
  if (
    mimeType === 'application/vnd.ms-excel' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'text/csv'
  )
    return 'table_chart'
  if (mimeType === 'text/plain') return 'article'
  if (
    mimeType === 'application/zip' ||
    mimeType === 'application/x-zip-compressed' ||
    mimeType === 'application/gzip'
  )
    return 'folder_zip'

  return 'insert_drive_file'
}

function formatFileSize(bytes?: number): string | null {
  if (bytes == null) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function truncateFilename(name: string, maxLength = 30): string {
  if (name.length <= maxLength) return name
  return name.slice(0, maxLength - 3) + '...'
}

export function FileCard({ filename, mimeType, fileSizeBytes, onDownload }: FileCardProps) {
  const icon = getFileIcon(mimeType)
  const size = formatFileSize(fileSizeBytes)

  return (
    <div className="flex items-center gap-3 bg-surface-charcoal p-3">
      <Icon name={icon} size={28} className="text-warm-ash shrink-0" />

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm text-bone-white truncate" title={filename}>
          {truncateFilename(filename)}
        </span>
        {size && <span className="text-xs text-warm-ash">{size}</span>}
      </div>

      <button
        type="button"
        onClick={onDownload}
        className="text-ember text-xs font-medium shrink-0 hover:text-ember/80 transition-colors"
      >
        Download
      </button>
    </div>
  )
}
