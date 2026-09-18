import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'
import { adjustPeptide, getPeptideAccounts, getPeptideLogs, getPeptideSummary, savePeptideGrantConfig } from '@/api/peptide'
import type { PeptideAccount, PeptideAdjustDTO, PeptideGrantConfig, PeptideLog, PeptideSummary } from '@/types/peptide'

/**
 * 肽金券管理页的数据仓库。
 *
 * 只负责「接口调用 + 列表/分页状态」：总览、账户列表（分页 + userId 精确筛选）、
 * 全平台流水（分页 + userId/type/orderNo 组合筛选），以及人工调整与发放配置保存后的刷新。
 */
export const usePeptideStore = defineStore('peptide', () => {
  // ===== 总览 =====
  const summary = ref<PeptideSummary | null>(null)
  const summaryLoading = ref(false)

  // ===== 账户列表 =====
  const accounts = ref<PeptideAccount[]>([])
  const accountTotal = ref(0)
  const accountPage = ref(1)
  const accountSize = ref(20)
  /** 账户列表筛选：用户 ID（精确匹配，空串=全部）。 */
  const accountUserId = ref('')
  const accountLoading = ref(false)

  // ===== 全平台流水 =====
  const logs = ref<PeptideLog[]>([])
  const logTotal = ref(0)
  const logPage = ref(1)
  const logSize = ref(20)
  /** 流水筛选条件（用户 ID / 类型 / 订单号，均可为空）。 */
  const logFilters = reactive({ userId: '', type: '', orderNo: '' })
  const logLoading = ref(false)

  // ===== 动作状态 =====
  /** 人工调整提交中（按钮 loading）。 */
  const actionLoading = ref(false)
  /** 发放配置保存中（按钮 loading）。 */
  const configSaving = ref(false)

  /** 加载总览数据（账户数 / 待履约负债 / 累计发放与使用 / 每单金额 / 开关 / 生效起始成交日）。 */
  async function fetchSummary(): Promise<void> {
    summaryLoading.value = true
    try {
      summary.value = await getPeptideSummary()
    } finally {
      summaryLoading.value = false
    }
  }

  /** 加载账户列表（按当前页与 userId 筛选条件）。 */
  async function fetchAccounts(): Promise<void> {
    accountLoading.value = true
    try {
      const result = await getPeptideAccounts({
        userId: accountUserId.value.trim() || undefined,
        page: accountPage.value,
        pageSize: accountSize.value,
      })
      accounts.value = result.list
      accountTotal.value = result.total
    } finally {
      accountLoading.value = false
    }
  }

  /** 加载全平台流水（按当前页与三个筛选条件）。 */
  async function fetchLogs(): Promise<void> {
    logLoading.value = true
    try {
      const result = await getPeptideLogs({
        userId: logFilters.userId.trim() || undefined,
        type: logFilters.type || undefined,
        orderNo: logFilters.orderNo.trim() || undefined,
        page: logPage.value,
        pageSize: logSize.value,
      })
      logs.value = result.list
      logTotal.value = result.total
    } finally {
      logLoading.value = false
    }
  }

  /**
   * 人工调整肽金券（仅超级管理员）：成功后刷新总览与账户列表。
   * 错误（含 code=7100 余额不足）原样抛给页面处理，便于给出可读提示。
   */
  async function adjust(payload: PeptideAdjustDTO): Promise<void> {
    actionLoading.value = true
    try {
      await adjustPeptide(payload)
      await Promise.all([fetchSummary(), fetchAccounts()])
    } finally {
      actionLoading.value = false
    }
  }

  /** 保存发放配置：成功后重新拉取总览，让卡片区与配置区保持一致。 */
  async function saveGrantConfig(payload: PeptideGrantConfig): Promise<void> {
    configSaving.value = true
    try {
      await savePeptideGrantConfig(payload)
      await fetchSummary()
    } finally {
      configSaving.value = false
    }
  }

  return {
    summary, summaryLoading,
    accounts, accountTotal, accountPage, accountSize, accountUserId, accountLoading,
    logs, logTotal, logPage, logSize, logFilters, logLoading,
    actionLoading, configSaving,
    fetchSummary, fetchAccounts, fetchLogs, adjust, saveGrantConfig,
  }
})
