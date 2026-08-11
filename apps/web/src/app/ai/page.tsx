import { AiAssistantPage } from '@rosie/ai'
import { AiEmbeddedChatPanel } from '@/components/AiFloatingAssistantHost'

export default function AiPage() {
  return <AiAssistantPage chatPanel={<AiEmbeddedChatPanel />} />
}
