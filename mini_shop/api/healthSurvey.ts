import { request } from '@/utils/request'

/** 健康自查问卷题目：每题 1~5 分。文案固定由前端展示。 */
export interface HealthSurveyQuestion {
  /** 题目标题（如"精力与疲劳感"）。 */
  title: string
  /** 题目描述（具体感受）。 */
  description: string
}

/** 健康自查问卷单条记录（对应后端 HealthSurveyVO）。 */
export interface HealthSurveyRecord {
  id: string
  userId: string
  /** 10 题得分，每项 1~5。 */
  scores: number[]
  /** 总分（10 题相加，满分 50）。 */
  totalScore: number
  /** 等级：1=良好，2=轻度亚健康，3=明显缺肽。 */
  level: number
  /** 等级描述文案。 */
  levelDesc: string
  createTime: string
}

/** 我的问卷记录分页结果。 */
export interface HealthSurveyPageResult {
  total: number
  list: HealthSurveyRecord[]
  page: number
  pageSize: number
}

/** 提交问卷的请求体。 */
export type HealthSurveySubmitDTO = { scores: number[] }

/** 健康自查问卷的 10 道固定题目（来自《小分子肽健康需求自查问卷》）。 */
export const HEALTH_SURVEY_QUESTIONS: HealthSurveyQuestion[] = [
  {
    title: '精力与疲劳感',
    description: '我经常感到身体疲惫、乏力，即使经过充分休息也难以恢复精力充沛的状态。',
  },
  {
    title: '体力与肌肉力量',
    description: '我自觉肌肉力量有所下降，爬楼梯或进行日常体力活动时感觉比以前吃力，或运动后肌肉恢复缓慢。',
  },
  {
    title: '皮肤与头发状态',
    description: '我的皮肤变得干燥、粗糙、弹性变差或出现皱纹增多；同时头发可能干枯、易脱落。',
  },
  {
    title: '免疫与抵抗力',
    description: '我发现自己最近比较容易感冒、感染，或者生病后恢复的时间比以往更长。',
  },
  {
    title: '消化与食欲',
    description: '我食欲不佳，或者经常感觉腹胀、消化不良，排便规律也发生了改变（如便秘或腹泻）。',
  },
  {
    title: '记忆力与注意力',
    description: '我感觉自己的记忆力有所减退，或者注意力难以集中，思维反应不如以前敏捷。',
  },
  {
    title: '睡眠质量',
    description: '我存在入睡困难、夜间容易醒来或睡眠不深、多梦等问题，导致晨起后仍感觉未休息好。',
  },
  {
    title: '情绪状态',
    description: '我经常感到情绪低落、焦虑或情绪波动较大，缺乏积极的情绪体验。',
  },
  {
    title: '关节与腰腿健康',
    description: '我有关节或腰腿部的不适感，如酸痛、僵硬或活动受限，尤其在晨起或久坐后加重。',
  },
  {
    title: '整体健康自评',
    description: '与一年前相比，我主观感觉自己的整体健康状态在走下坡路，且这种趋势难以通过常规休息逆转。',
  },
]

/** 评分说明文案（用于页面底部提示）。 */
export const HEALTH_SURVEY_SCORE_TIPS = [
  { label: '1分', desc: '完全不符（几乎没有）' },
  { label: '2分', desc: '较少符合（偶尔）' },
  { label: '3分', desc: '一般符合（有时）' },
  { label: '4分', desc: '比较符合（经常）' },
  { label: '5分', desc: '非常符合（总是如此）' },
]

/** 根据总分计算等级与描述（Boss 确认的规则：<15 良好，15~30 轻度亚健康，>30 明显缺肽）。 */
export function healthSurveyLevel(totalScore: number): { level: number; levelDesc: string } {
  if (totalScore < 15) return { level: 1, levelDesc: '良好' }
  if (totalScore <= 30) return { level: 2, levelDesc: '轻度亚健康' }
  return { level: 3, levelDesc: '明显缺肽' }
}

function normalizeRecord(value: Partial<HealthSurveyRecord>): HealthSurveyRecord {
  return { ...value, id: String(value.id ?? ''), userId: String(value.userId ?? '') } as HealthSurveyRecord
}

/** 提交健康自查问卷（需登录）。成功返回总分与等级。 */
export async function submitHealthSurvey(payload: HealthSurveySubmitDTO): Promise<HealthSurveyRecord> {
  const result = await request<HealthSurveyRecord>({ url: '/api/health-survey/submit', method: 'POST', data: payload })
  return normalizeRecord(result)
}

/** 查询我的问卷记录（分页，需登录）。 */
export async function getMyHealthSurveys(page = 1, pageSize = 10): Promise<HealthSurveyPageResult> {
  const data = await request<HealthSurveyPageResult>({ url: `/api/health-survey/my?page=${page}&pageSize=${pageSize}`, method: 'GET' })
  const list = ((data?.list || []) as Partial<HealthSurveyRecord>[]).map(normalizeRecord)
  return { total: Number(data?.total || 0), list, page: Number(data?.page || page), pageSize: Number(data?.pageSize || pageSize) }
}
