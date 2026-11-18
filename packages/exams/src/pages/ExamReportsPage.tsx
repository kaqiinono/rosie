'use client'

import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import { createUserSessionStore, useAuth } from '@rosie/core'
import { LoadingOverlay, PageShell, StickerCard } from '@rosie/ui'
import { Badge, Button, Flex, Heading, Table, Text } from '@rosie/ui/themes'
import { examRequest, ExamRequestError } from '../client/examApi'
import { StartExamButton } from '../components/StartExamButton'
import type { ExamEvidenceExclusion, ExamLearningReport, ExamReportEvidence } from '../types/reports'

const stores = {
  14: createUserSessionStore<ExamLearningReport | null>('exams-reports:14', { empty: null, fetch: userId => examRequest(userId, '/api/exams/reports?days=14') }),
  28: createUserSessionStore<ExamLearningReport | null>('exams-reports:28', { empty: null, fetch: userId => examRequest(userId, '/api/exams/reports?days=28') }),
}
const exclusions: Record<ExamEvidenceExclusion, string> = {
  not_objective: '非客观题', missing_result: '无客观判定', missing_exposure: '材料接触记录不足', seen_material: '此前已见材料',
  help: '共享题组曾求助', technical_interruption: '技术中断', repeated_question: '同题重复提交', outside_window: '不在统计窗口',
}
const sectionNames: Record<string, string> = { reading_writing: '阅读与写作', listening: '听力', speaking: '口语' }
const outcomes: Record<string, string> = { correct: '答对', incorrect: '答错', unanswered: '未答', pending: '待批改', unscored: '不计分', graded: '已人工评分', missing: '判定缺失' }
const formatTime = (time: string) => new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(time))
const ratio = (numerator: number, denominator: number) => denominator ? `${numerator}/${denominator}（${Math.round(numerator / denominator * 100)}%）` : '暂无有效样本'

function Disclosure({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return <Flex direction="column" gap="3"><Button size="3" variant="soft" aria-expanded={open} onClick={() => setOpen(value => !value)}>{open ? '收起' : '展开'}{title}</Button>
    {open && children}</Flex>
}

function EvidenceList({ items }: { items: readonly ExamReportEvidence[] }) {
  const [limit, setLimit] = useState(20)
  return <Flex direction="column" gap="3">
    <Text size="2" color="gray">共 {items.length} 次提交记录。有效样本按题目去重；排除原因可能同时出现，不相加为总题数。</Text>
    {items.slice(0, limit).map(item => <StickerCard key={`${item.attemptId}:${item.questionId}`} elevation="flat" size="sm"><Flex direction="column" gap="2">
      <Text size="2" className="break-all">{item.questionId}</Text>
      <Flex gap="2" wrap="wrap"><Badge variant="soft" radius="full" color={item.included ? 'green' : 'gray'}>{item.included ? '计入首次独立样本' : '未计入独立样本'}</Badge>
        <Badge variant="soft" radius="full">{outcomes[item.outcome] ?? item.outcome}</Badge>{item.timedOut && <Badge variant="soft" radius="full" color="orange">超时结算</Badge>}</Flex>
      <Text size="2">{formatTime(item.submittedAt)} · {sectionNames[item.sectionId] ?? item.sectionId} Part {item.partNumber}</Text>
      <Text size="2" color="gray" className="break-all">材料家族：{item.familyIds.join('、') || '未关联'}</Text>
      {!!item.exclusions.length && <Text size="2">排除原因：{item.exclusions.map(reason => exclusions[reason]).join('；')}</Text>}
      <Button size="2" variant="soft" asChild><Link href={`/exams/attempts/${item.attemptId}`}>打开已提交会话复盘</Link></Button>
    </Flex></StickerCard>)}
    {items.length > limit && <Button size="3" variant="soft" onClick={() => setLimit(value => value + 20)}>显示更多依据（已显示 {limit}/{items.length}）</Button>}
  </Flex>
}

function ReportBody({ report }: { report: ExamLearningReport }) {
  const [attemptLimit, setAttemptLimit] = useState(10)
  const [insightLimit, setInsightLimit] = useState(10)
  const [manualLimit, setManualLimit] = useState(10)
  return <Flex direction="column" gap="5">
    <Text size="2" color="gray">{report.window.fromDate} 至 {report.window.throughDate} · 上海日期 · 更新于 {formatTime(report.generatedAt)}</Text>
    <StickerCard as="section" size="lg"><Flex direction="column" gap="4"><Heading as="h2" size="5">接下来做什么</Heading>
      {!report.recommendations.length && <Text as="p">暂时没有需要继续的任务或有足够依据的建议。可以从专项练习选择已发布题组。</Text>}
      {report.recommendations.map(item => <Flex key={item.id} direction="column" gap="2">
        <Text weight="bold">{item.title}</Text><Text as="p" size="2">{item.reason}</Text>
        {item.practice && <StartExamButton mode="practice" revisionId={item.practice.revisionId} groupId={item.practice.groupId} wordReviewBatchId={item.practice.wordReviewBatchId} />}
        {item.href && <Button size="3" variant="soft" asChild><Link href={item.href}>{item.kind === 'continue' ? '继续学习' : item.kind === 'words' ? '打开词汇补练' : '查看复盘'}</Link></Button>}
        {!!item.evidenceQuestionIds.length && <Disclosure title="建议依据"><Text size="2" className="break-all">{item.evidenceQuestionIds.join('、')}</Text></Disclosure>}
      </Flex>)}
    </Flex></StickerCard>

    <StickerCard as="section" size="lg"><Flex direction="column" gap="3"><Heading as="h2" size="5">这段时间的学习</Heading>
      <Flex gap="3" wrap="wrap"><Badge variant="soft" radius="full">完成 {report.progress.completedSessions} 次会话</Badge>
        <Badge variant="soft" radius="full">不同考试题 {report.progress.questionCount} 道</Badge><Badge variant="soft" radius="full">不同题组 {report.progress.groupCount} 组</Badge>
        <Badge variant="soft" radius="full">未完成会话 {report.progress.unfinishedSessions} 次</Badge><Badge variant="soft" radius="full">待人工批改 {report.progress.pendingManual} 题</Badge></Flex>
      <Text as="p">首次独立客观题：{ratio(report.performance.numerator, report.performance.denominator)}</Text>
      <Text size="2" color="gray">只计未见材料上的首次独立作答。未答客观题计入分母；写作、口语及例题分开展示。未完成会话包含窗口之前已开始的任务。</Text>
      <Text size="2">求助后答对 {report.performance.helped.correct}/{report.performance.helped.total}；原题重做答对 {report.performance.repeated.correct}/{report.performance.repeated.total}；已见材料答对 {report.performance.seen.correct}/{report.performance.seen.total}；中断会话答对 {report.performance.interrupted.correct}/{report.performance.interrupted.total}。</Text>
      <Text size="2" color="gray">以上分组可能重叠，不合并为独立正确率；耗时只记录题组，不分摊为单题能力。</Text>
      <Disclosure title="考试题来源与排除原因"><EvidenceList items={report.evidence} /></Disclosure>
      <Disclosure title="每日记录与覆盖范围"><div className="overflow-x-auto"><Table.Root variant="surface"><Table.Header><Table.Row>
        <Table.ColumnHeaderCell>上海日期</Table.ColumnHeaderCell><Table.ColumnHeaderCell>客观题提交</Table.ColumnHeaderCell><Table.ColumnHeaderCell>独立答对／有效题</Table.ColumnHeaderCell>
      </Table.Row></Table.Header><Table.Body>{report.days.map(day => <Table.Row key={day.date}><Table.Cell>{day.date}</Table.Cell><Table.Cell>{day.submittedQuestions}</Table.Cell><Table.Cell>{day.numerator}/{day.denominator}</Table.Cell></Table.Row>)}</Table.Body></Table.Root></div>
        <Text size="2" className="break-all">题型：{report.performance.questionTypes.join('、') || '暂无'}。考点：{report.performance.knowledgePoints.join('、') || '暂无'}。</Text>
      </Disclosure>
    </Flex></StickerCard>

    <StickerCard as="section" size="lg"><Flex direction="column" gap="3"><Heading as="h2" size="5">技能与考点观察</Heading>
      <Text as="p" size="2">固定窗口：{report.insightWindow.fromDate} 至 {report.insightWindow.throughDate}（最近 28 天）。同一标签至少 8 道有效题、3 个材料家族、2 次会话，正确率低于 70% 时才建议加强。</Text>
      <Text size="2" color="gray">规则 {report.ruleVersion} 只提供练习线索，不判断出错根因，不换算官方分数或预测通过率。多个考点的样本不应相加。</Text>
      {!report.insights.length && <Text>尚无可观察的客观题记录。</Text>}
      {report.insights.slice(0, insightLimit).map(item => <StickerCard key={`${item.kind}:${item.id}`} elevation="flat" size="sm"><Flex direction="column" gap="3">
        <Flex gap="2" wrap="wrap"><Text weight="bold" className="break-all">{item.kind === 'skill' ? '技能' : '考点'} · {item.id}</Text><Badge variant="soft" radius="full" color={item.status === 'strengthen' ? 'orange' : 'gray'}>{item.status === 'observe' ? '待观察' : item.status === 'strengthen' ? '建议加强' : '样本已达门槛'}</Badge></Flex>
        <Text size="2">独立答对 {item.numerator}/{item.denominator} · {item.familyCount} 个家族 · {item.sessionCount} 次会话</Text>
        <Disclosure title="本条结论的题目依据"><EvidenceList items={item.evidence} /></Disclosure>
      </Flex></StickerCard>)}
      {report.insights.length > insightLimit && <Button size="3" variant="soft" onClick={() => setInsightLimit(value => value + 10)}>显示更多观察项</Button>}
    </Flex></StickerCard>

    <StickerCard as="section" size="lg"><Flex direction="column" gap="3"><Heading as="h2" size="5">词汇补练 · 单独记录</Heading>
      <Text>完成 {report.words.completedBatches} 个批次、{report.words.completedWords} 个不同词条；当前待补练 {report.words.pendingWords} 个词条。</Text>
      <Text size="2">词义首次独立答对：{ratio(report.words.meaning.independentCorrect, report.words.meaning.independentAttempts)}；累计作答 {report.words.meaning.attempts} 次，求助 {report.words.meaning.helpClicks} 次。</Text>
      <Text size="2">拼写首次独立答对：{ratio(report.words.spelling.independentCorrect, report.words.spelling.independentAttempts)}；累计作答 {report.words.spelling.attempts} 次，求助 {report.words.spelling.helpClicks} 次。</Text>
      <Text size="2">新材料应用证据 {report.words.applicationWords} 个词条；仍待验证 {report.words.awaitingVerificationWords} 个词条。</Text>
      <Text size="2" color="gray">只展示本模块实际完成的补练证据，和考试题数分列。应用证据须关联补练批次并在新材料独立答对；单次成功不会标为完全掌握。未导入旧词库推算日志。</Text>
    </Flex></StickerCard>

    <StickerCard as="section" size="lg"><Flex direction="column" gap="3"><Heading as="h2" size="5">已提交会话与 Part 记录</Heading>
      {!report.attempts.length && <Text>所选日期内还没有已提交的科目。完成后可以在这里复盘。</Text>}
      {report.attempts.slice(0, attemptLimit).map(attempt => <StickerCard key={attempt.id} as="article" elevation="flat" size="sm"><Flex direction="column" gap="3">
        <Text weight="bold">{attempt.title}</Text><Flex gap="2" wrap="wrap"><Badge variant="soft" radius="full">{attempt.mode === 'mock' ? '模考' : '练习'}</Badge><Badge variant="soft" radius="full">{attempt.status === 'completed' ? '已完成' : attempt.status === 'pending_review' ? '待人工批改' : '部分科目已提交'}</Badge></Flex>
        <Disclosure title="Part 与题组耗时">{attempt.parts.map(part => <Flex key={`${part.sectionId}:${part.partNumber}`} direction="column" gap="2">
          <Text weight="bold" size="2">{sectionNames[part.sectionId] ?? part.sectionId} Part {part.partNumber}</Text>
          <Text size="2">{part.objectiveMaximum > 0 ? `客观题 ${part.objectivePoints}/${part.objectiveMaximum}；漏答 ${part.unanswered}；` : '本 Part 使用人工评价；'}待批改 {part.pendingManual}；求助 {part.helpCount}。{part.interrupted ? '有技术中断。' : ''}{part.timedOut ? '超时结算。' : ''}</Text>
          {part.groups.map(group => <Text key={group.id} size="2" className="break-all">{group.id} · 已记录活跃时长 {Math.floor(group.activeMs / 1000)} 秒</Text>)}
        </Flex>)}</Disclosure>
        <Button size="3" variant="soft" asChild><Link href={`/exams/attempts/${attempt.id}`}>打开会话复盘</Link></Button>
      </Flex></StickerCard>)}
      {report.attempts.length > attemptLimit && <Button size="3" variant="soft" onClick={() => setAttemptLimit(value => value + 10)}>显示更多会话</Button>}
    </Flex></StickerCard>

    <StickerCard as="section" size="lg"><Flex direction="column" gap="3"><Heading as="h2" size="5">写作与口语人工评价</Heading>
      <Text size="2" color="gray">待批改不计零分。显示所选窗口内的评价与修订，不套用客观题弱项阈值。</Text>
      {!report.manualEvaluations.length && <Text>此窗口内暂无人工评价。</Text>}
      {report.manualEvaluations.slice(0, manualLimit).map(review => <StickerCard key={review.id} size="sm" elevation="flat"><Flex direction="column" gap="2">
        <Text size="2" className="break-all">{review.questionId}</Text><Badge variant="soft" radius="full">{review.current ? '当前评价' : '历史修订'}</Badge>
        <Text size="2">{formatTime(review.reviewedAt)} · 本次评价 {review.points}/{review.maxPoints}</Text>
        {review.dimensions.map(dimension => <Text key={dimension.id} size="2">{dimension.id}：{dimension.score}{dimension.comment ? ` · ${dimension.comment}` : ''}</Text>)}
        <Text as="p">{review.comment || '本次未填写补充评语。'}</Text>
      </Flex></StickerCard>)}
      {report.manualEvaluations.length > manualLimit && <Button size="3" variant="soft" onClick={() => setManualLimit(value => value + 10)}>显示更多评价历史</Button>}
    </Flex></StickerCard>
    {!!report.gaps.length && <StickerCard tone="warning" elevation="flat"><Flex direction="column" gap="2">{report.gaps.map(gap => <Text key={gap} size="2">{gap}</Text>)}</Flex></StickerCard>}
  </Flex>
}

export function ExamReportsPage() {
  const { user } = useAuth()
  const [days, setDays] = useState<14 | 28>(14)
  const [refreshing, setRefreshing] = useState(false)
  const store = stores[days]
  const { data, isLoading, error } = store.useSessionData(user)
  const errorText = error instanceof ExamRequestError && error.status === 401 ? '登录已过期，请重新登录。'
    : error instanceof ExamRequestError && error.code === 'exam_report_limit' ? '历史记录超出本次报告读取范围，报告暂未生成；没有使用截断记录判断弱项。'
      : '暂时无法读取完整报告，请重试。已有报告保留上次更新时间。'
  async function refresh() {
    if (!user || refreshing) return
    setRefreshing(true)
    try { await store.refreshInBackground(user.id) } catch { /* The session store owns the error. */ }
    finally { setRefreshing(false) }
  }
  return <PageShell title="学习报告与复盘" tone="paper" width="default" showAccount><Flex direction="column" gap="5">
    <Flex gap="3" wrap="wrap" align="center"><Button size="3" variant={days === 14 ? 'solid' : 'soft'} aria-pressed={days === 14} onClick={() => setDays(14)}>最近 14 天</Button>
      <Button size="3" variant={days === 28 ? 'solid' : 'soft'} aria-pressed={days === 28} onClick={() => setDays(28)}>最近 28 天</Button>
      <Button size="3" variant="soft" loading={refreshing} onClick={() => void refresh()}>{error ? '重试' : '刷新报告'}</Button></Flex>
    {error ? <StickerCard tone="danger" elevation="flat"><Text as="p" role="alert">{errorText}</Text></StickerCard> : null}
    <div className="relative flex min-h-[calc(100dvh-16rem)] flex-col"><LoadingOverlay appearance="quiet" visible={isLoading} placement="content" />
      {!isLoading && data && <ReportBody key={`${days}:${data.generatedAt}`} report={data} />}
    </div>
  </Flex></PageShell>
}
