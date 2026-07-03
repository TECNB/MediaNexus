import { Navigate, useParams } from 'react-router-dom'

export function LegacyResourceIngestRedirect() {
  const { mediaType, taskId } = useParams()

  if ((mediaType !== 'movie' && mediaType !== 'series') || !taskId) {
    return <Navigate to="/tasks" replace />
  }

  return (
    <Navigate
      to={`/tasks/${mediaType}/${encodeURIComponent(taskId)}`}
      replace
    />
  )
}
