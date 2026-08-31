/** 健康自查问卷的 10 道固定题目（与 C 端一致，来自《小分子肽健康需求自查问卷》）。 */
export interface HealthQuestion {
  title: string
  description: string
}

export const HEALTH_SURVEY_QUESTIONS: HealthQuestion[] = [
  { title: '精力与疲劳感', description: '我经常感到身体疲惫、乏力，即使经过充分休息也难以恢复精力充沛的状态。' },
  { title: '体力与肌肉力量', description: '我自觉肌肉力量有所下降，爬楼梯或进行日常体力活动时感觉比以前吃力，或运动后肌肉恢复缓慢。' },
  { title: '皮肤与头发状态', description: '我的皮肤变得干燥、粗糙、弹性变差或出现皱纹增多；同时头发可能干枯、易脱落。' },
  { title: '免疫与抵抗力', description: '我发现自己最近比较容易感冒、感染，或者生病后恢复的时间比以往更长。' },
  { title: '消化与食欲', description: '我食欲不佳，或者经常感觉腹胀、消化不良，排便规律也发生了改变（如便秘或腹泻）。' },
  { title: '记忆力与注意力', description: '我感觉自己的记忆力有所减退，或者注意力难以集中，思维反应不如以前敏捷。' },
  { title: '睡眠质量', description: '我存在入睡困难、夜间容易醒来或睡眠不深、多梦等问题，导致晨起后仍感觉未休息好。' },
  { title: '情绪状态', description: '我经常感到情绪低落、焦虑或情绪波动较大，缺乏积极的情绪体验。' },
  { title: '关节与腰腿健康', description: '我有关节或腰腿部的不适感，如酸痛、僵硬或活动受限，尤其在晨起或久坐后加重。' },
  { title: '整体健康自评', description: '与一年前相比，我主观感觉自己的整体健康状态在走下坡路，且这种趋势难以通过常规休息逆转。' },
]
