import { PageBreadcrumb } from '@rosie/ui'
import { Container, Flex, Heading, Separator } from '@rosie/ui/themes'
import BaiduSyncDirectories from '@/components/settings/BaiduSyncDirectories'

export default function SyncPage() {
  return (
    <Flex direction="column" minHeight="100dvh">
      <Container size="3" width="100%" px="4" flexGrow="0">
        <Flex align="center" gap="3" py="2">
          <PageBreadcrumb variant="inline" />
          <Heading as="h1" size="4">
            同步管理
          </Heading>
        </Flex>
      </Container>
      <Separator size="4" />
      <Flex
        direction="column"
        role="main"
        width="100%"
        maxWidth="960px"
        mx="auto"
        px="4"
        py="4"
        flexGrow="1"
      >
        <BaiduSyncDirectories />
      </Flex>
    </Flex>
  )
}
