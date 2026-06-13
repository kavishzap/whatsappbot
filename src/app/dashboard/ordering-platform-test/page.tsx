const ORDERING_PLATFORM_URL = 'https://sodamax-online-order.netlify.app'

export default function OrderingPlatformTestPage() {
  return (
    <div className="flex flex-col flex-1 min-h-0 -m-4 sm:-m-6">
      <iframe
        src={ORDERING_PLATFORM_URL}
        title="Ordering Platform Test"
        className="flex-1 w-full min-h-0 border-0 bg-white"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  )
}
