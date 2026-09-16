<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { createThrottle } from '@/utils/interaction'
import { isLoggedIn } from '@/utils/auth'
import {
  getMyHealthSurveys,
  HEALTH_SURVEY_QUESTIONS,
  HEALTH_SURVEY_SCORE_TIPS,
  healthSurveyLevel,
  submitHealthSurvey,
  type HealthSurveyRecord,
} from '@/api/healthSurvey'
import LoginGuide from '@/components/LoginGuide.vue'

const menuTop = ref(0)
const menuHeight = ref(32)
const navigationThrottle = createThrottle(500)
const navStyle = computed(() => ({ top: `${menuTop.value}px`, height: `${menuHeight.value}px` }))
const bodyStyle = computed(() => ({ paddingTop: `${menuTop.value + menuHeight.value + uni.upx2px(20)}px` }))

/** 每题得分：与题目序索引对应，初值 0 表示未选。 */
const scores = ref<number[]>(Array.from({ length: HEALTH_SURVEY_QUESTIONS.length }, () => 0))
/** 是否全部作答。 */
const allAnswered = computed(() => scores.value.every((value) => value >= 1 && value <= 5))
/** 当前总分（用于提交前预览）。 */
const currentTotal = computed(() => scores.value.reduce((sum, value) => sum + value, 0))
const submitting = ref(false)
const loginGuideVisible = ref(false)
/** 提交结果弹窗数据。 */
const resultVisible = ref(false)
const resultRecord = ref<HealthSurveyRecord | null>(null)
/** 我的历史记录。 */
const records = ref<HealthSurveyRecord[]>([])
const recordsTotal = ref(0)
const recordsPage = ref(1)
const recordsLoading = ref(false)
const recordPageSize = 10

/** 点击评分按钮，写入对应题得分。 */
function selectScore(index: number, value: number): void {
  scores.value[index] = value
}

/** 返回上一页。 */
function goBack(): void {
  if (!navigationThrottle()) return
  uni.navigateBack({ delta: 1 })
}

/** 提交问卷（需登录）。 */
async function submit(): Promise<void> {
  if (submitting.value) return
  if (!allAnswered.value) {
    uni.showToast({ title: '请完成全部题目后再提交', icon: 'none' })
    return
  }
  if (!isLoggedIn()) {
    loginGuideVisible.value = true
    return
  }
  submitting.value = true
  try {
    const saved = await submitHealthSurvey({ scores: [...scores.value] })
    // 用本地得分计算总分与等级，避免因后端字段差异导致结果展示异常。
    const localTotal = scores.value.reduce((sum, value) => sum + value, 0)
    const levelInfo = healthSurveyLevel(localTotal)
    resultRecord.value = { ...saved, totalScore: localTotal, scores: [...scores.value], level: levelInfo.level, levelDesc: levelInfo.levelDesc }
    resultVisible.value = true
    await loadRecords(1)
  } catch (error) {
    const message = error instanceof Error ? error.message : '提交失败，请稍后重试'
    uni.showToast({ title: message, icon: 'none' })
  } finally {
    submitting.value = false
  }
}

/** 加载我的问卷记录。 */
async function loadRecords(page = 1): Promise<void> {
  if (!isLoggedIn()) return
  recordsLoading.value = true
  recordsPage.value = page
  try {
    const result = await getMyHealthSurveys(page, recordPageSize)
    records.value = result.list
    recordsTotal.value = result.total
  } catch {
    records.value = []
    recordsTotal.value = 0
  } finally {
    recordsLoading.value = false
  }
}

function loadMoreRecords(): void {
  if (recordsLoading.value || records.value.length >= recordsTotal.value) return
  void loadRecords(recordsPage.value + 1)
}

onMounted(() => {
  try {
    const rect = uni.getMenuButtonBoundingClientRect()
    if (rect) { menuTop.value = rect.top; menuHeight.value = rect.height }
  } catch { /* 非微信环境忽略 */ }
  void loadRecords(1)
})
</script>

<template>
  <view class="page">
    <view class="nav" :style="navStyle">
      <image class="back" src="/static/left_arrow.png" mode="aspectFit" @click="goBack" />
      <text class="title">健康自查问卷</text>
      <view class="spacer" />
    </view>

    <scroll-view class="scroll" scroll-y :style="bodyStyle">
      <view class="content">
        <!-- 使用说明 -->
        <view class="intro">
          <text class="intro-title">今华有肽健康需求自查问卷</text>
          <text class="intro-text">请根据您近一个月内的真实身体状况，对以下每项描述进行评分（1~5 分）。</text>
          <view class="score-tips">
            <view v-for="tip in HEALTH_SURVEY_SCORE_TIPS" :key="tip.label" class="score-tip">
              <text class="score-tip-label">{{ tip.label }}</text>
              <text class="score-tip-desc">{{ tip.desc }}</text>
            </view>
          </view>
        </view>

        <!-- 10 题评分 -->
        <view
          v-for="(question, index) in HEALTH_SURVEY_QUESTIONS"
          :key="question.title"
          class="question-card"
        >
          <text class="question-index">{{ index + 1 }}</text>
          <view class="question-body">
            <text class="question-title">{{ question.title }}</text>
            <text class="question-desc">{{ question.description }}</text>
            <view class="score-row">
              <view
                v-for="score in 5"
                :key="score"
                class="score-button"
                :class="{ 'score-button--active': scores[index] === score }"
                @click="selectScore(index, score)"
              >
                <text class="score-button-text">{{ score }}</text>
              </view>
            </view>
          </view>
        </view>

        <!-- 提交 -->
        <view class="submit-wrap">
          <button class="submit-button" :class="{ 'submit-button--disabled': !allAnswered }" :loading="submitting" @click="submit">提交问卷</button>
          <text class="submit-tip">当前已选总分：{{ currentTotal }} / 50</text>
        </view>

        <!-- 我的记录 -->
        <view class="record-section">
          <text class="record-heading">我的记录（{{ recordsTotal }}）</text>
          <view v-if="recordsLoading && !records.length" class="record-empty">加载中...</view>
          <view v-else-if="!records.length" class="record-empty">暂无问卷记录</view>
          <view v-else>
            <view v-for="record in records" :key="record.id" class="record-item" @click.stop>
              <view class="record-top">
                <text class="record-time">{{ record.createTime }}</text>
                <text class="record-level">{{ record.levelDesc }}</text>
              </view>
              <view class="record-meta">
                <text>总分 {{ record.totalScore }}</text>
                <text>等级 {{ record.level }}</text>
              </view>
              <view class="record-scores">
                <view v-for="(score, index) in record.scores" :key="index" class="record-score">
                  <text class="record-score-num">{{ index + 1 }}</text>
                  <text class="record-score-val">{{ score }}</text>
                </view>
              </view>
            </view>
            <view class="record-more" @click="loadMoreRecords">
              <text v-if="records.length < recordsTotal">查看更多</text>
              <text v-else>已显示全部</text>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- 结果弹窗：仅提交成功后挂载，点击遮罩或按钮均可关闭 -->
    <view v-if="resultVisible && resultRecord" class="result-mask" @click="resultVisible = false">
      <view class="result-dialog" @click.stop>
        <text class="result-title">测评结果</text>
        <text class="result-total">总分 {{ resultRecord?.totalScore }} 分</text>
        <text class="result-level">{{ resultRecord?.levelDesc }}</text>
        <text class="result-note">本问卷仅作为健康状况的自我筛查参考，不能替代专业医疗诊断。小分子肽属于营养补充剂范畴，不能替代药物用于治疗疾病。</text>
        <button class="result-close" @click.stop="resultVisible = false">我知道了</button>
      </view>
    </view>

    <LoginGuide v-model="loginGuideVisible" />
  </view>
</template>

<style scoped>
.page { position: relative; height: 100vh; overflow: hidden; background: #f5f6f8; color: #172033; font-family: 'PingFang SC', '苹方-简', sans-serif; }
.nav { position: fixed; right: 0; left: 0; z-index: 20; display: flex; align-items: center; padding: 0 32rpx; box-sizing: border-box; background: #f5f6f8; }
.back { width: 34rpx; height: 34rpx; flex-shrink: 0; }
.title { position: absolute; left: 50%; color: #111; font-size: 32rpx; font-weight: 600; transform: translateX(-50%); }
.spacer { width: 34rpx; height: 34rpx; }
.scroll { position: absolute; inset: 0; box-sizing: border-box; }
.content { padding: 24rpx 24rpx 60rpx; }
.intro { padding: 28rpx; border-radius: 20rpx; background: #fff; }
.intro-title { display: block; color: #172033; font-size: 30rpx; font-weight: 700; }
.intro-text { display: block; margin-top: 12rpx; color: #475467; font-size: 24rpx; line-height: 1.6; }
.score-tips { display: flex; flex-direction: column; gap: 8rpx; margin-top: 16rpx; }
.score-tip { display: flex; align-items: center; gap: 12rpx; }
.score-tip-label { flex-shrink: 0; width: 96rpx; color: #98476b; font-size: 22rpx; font-weight: 600; }
.score-tip-desc { color: #98a2b3; font-size: 22rpx; }
.question-card { display: flex; gap: 16rpx; margin-top: 20rpx; padding: 24rpx; border-radius: 20rpx; background: #fff; }
.question-index { flex-shrink: 0; display: flex; align-items: center; justify-content: center; width: 40rpx; height: 40rpx; border-radius: 50%; color: #fff; background: #98476b; font-size: 22rpx; font-weight: 700; }
.question-body { flex: 1; min-width: 0; }
.question-title { display: block; color: #172033; font-size: 28rpx; font-weight: 600; }
.question-desc { display: block; margin-top: 8rpx; color: #475467; font-size: 24rpx; line-height: 1.6; }
.score-row { display: flex; gap: 18rpx; margin-top: 18rpx; }
.score-button { display: flex; align-items: center; justify-content: center; width: 72rpx; height: 72rpx; border-radius: 50%; color: #98a2b3; background: #f2f4f7; font-size: 26rpx; font-weight: 600; }
.score-button--active { color: #fff; background: #98476b; }
.score-button-text { line-height: 1; }
.submit-wrap { margin-top: 28rpx; padding: 28rpx; border-radius: 20rpx; background: #fff; }
.submit-button { height: 88rpx; border-radius: 44rpx; color: #fff; background: #98476b; font-size: 30rpx; font-weight: 600; line-height: 88rpx; }
.submit-button--disabled { opacity: .5; }
.submit-tip { display: block; margin-top: 14rpx; color: #98a2b3; font-size: 22rpx; text-align: center; }
.record-section { margin-top: 28rpx; }
.record-heading { display: block; margin-bottom: 12rpx; color: #344054; font-size: 28rpx; font-weight: 600; }
.record-empty { padding: 32rpx; color: #98a2b3; font-size: 24rpx; text-align: center; background: #fff; border-radius: 20rpx; }
.record-item { margin-bottom: 16rpx; padding: 24rpx; border-radius: 20rpx; background: #fff; }
.record-top { display: flex; align-items: center; justify-content: space-between; }
.record-time { color: #98a2b3; font-size: 22rpx; }
.record-level { color: #98476b; font-size: 24rpx; font-weight: 600; }
.record-meta { display: flex; gap: 32rpx; margin-top: 12rpx; color: #344054; font-size: 24rpx; }
.record-scores { display: flex; flex-wrap: wrap; gap: 10rpx; margin-top: 14rpx; }
.record-score { display: flex; align-items: center; gap: 4rpx; padding: 6rpx 12rpx; border-radius: 8rpx; background: #f5f6f8; }
.record-score-num { color: #98a2b3; font-size: 20rpx; }
.record-score-val { color: #98476b; font-size: 22rpx; font-weight: 600; }
.record-more { padding: 20rpx 0; color: #98476b; font-size: 24rpx; text-align: center; }
.result-mask { position: fixed; inset: 0; z-index: 40; display: flex; align-items: center; justify-content: center; padding: 40rpx; box-sizing: border-box; background: rgba(0, 0, 0, .5); }
.result-dialog { width: 100%; max-width: 600rpx; padding: 40rpx 36rpx; border-radius: 24rpx; background: #fff; text-align: center; }
.result-title { display: block; color: #172033; font-size: 32rpx; font-weight: 700; }
.result-total { display: block; margin-top: 24rpx; color: #98476b; font-size: 48rpx; font-weight: 700; }
.result-level { display: block; margin-top: 8rpx; color: #344054; font-size: 30rpx; font-weight: 600; }
.result-note { display: block; margin-top: 20rpx; color: #98a2b3; font-size: 22rpx; line-height: 1.6; }
.result-close { height: 80rpx; margin-top: 28rpx; border-radius: 40rpx; color: #fff; background: #98476b; font-size: 28rpx; font-weight: 600; line-height: 80rpx; }
</style>
