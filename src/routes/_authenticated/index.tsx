import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/')({
  component: IndexPage,
})

function IndexPage() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Welcome to Ardent Forge</h1>
      <p className="mt-2 text-muted-foreground">Your workout log is ready.</p>
    </div>
  )
}
