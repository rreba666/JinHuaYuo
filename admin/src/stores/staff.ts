import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createStaff, deleteStaff, getStaff, resetStaffPassword, restoreStaff, updateStaff, updateStaffStatus } from '@/api/staff'
import type { Staff, StaffCreateDTO, StaffPageResult, StaffResetPasswordDTO, StaffStatus, StaffUpdateDTO } from '@/types/staff'
import { runBatch } from '@/utils/runBatch'

export const useStaffStore = defineStore('staff', () => {
  const list = ref<StaffPageResult['list']>([])
  const total = ref(0)
  const loading = ref(false)
  const saving = ref(false)
  const actionLoading = ref(false)
  const page = ref(1)
  const pageSize = ref(10)
  /** 店员搜索关键词（纯数字按 ID，否则按姓名/工号模糊）。 */
  const keyword = ref('')

  /** 加载店员分页列表。 */
  async function fetchList(): Promise<void> {
    loading.value = true
    try {
      const result = await getStaff(page.value, pageSize.value, keyword.value)
      list.value = result.list
      total.value = result.total
    } finally {
      loading.value = false
    }
  }

  /** 新增或编辑店员。 */
  async function save(id: string | undefined, payload: StaffCreateDTO | StaffUpdateDTO): Promise<void> {
    saving.value = true
    try {
      if (id) await updateStaff(id, payload as StaffUpdateDTO)
      else await createStaff(payload as StaffCreateDTO)
      await fetchList()
    } finally {
      saving.value = false
    }
  }

  /** 更新店员状态。 */
  async function setStatus(staff: Staff, status: StaffStatus): Promise<void> {
    actionLoading.value = true
    try {
      await updateStaffStatus(staff.id, status)
      staff.status = status
    } finally {
      actionLoading.value = false
    }
  }

  /** 重置店员登录密码。 */
  async function resetPassword(id: string, payload: StaffResetPasswordDTO): Promise<void> {
    actionLoading.value = true
    try {
      await resetStaffPassword(id, payload)
    } finally {
      actionLoading.value = false
    }
  }

  /** 软删除单个店员并刷新列表。 */
  async function remove(id: string): Promise<void> {
    actionLoading.value = true
    try {
      await deleteStaff(id)
      await fetchList()
    } finally {
      actionLoading.value = false
    }
  }

  /** 批量软删除店员，复用单条接口并限制并发数。 */
  async function removeBatch(ids: string[]): Promise<{ successIds: string[]; failedIds: string[] }> {
    const uniqueIds = [...new Set(ids.filter(Boolean))]
    if (!uniqueIds.length) return { successIds: [], failedIds: [] }
    actionLoading.value = true
    try {
      const result = await runBatch(uniqueIds, (id) => deleteStaff(id), 3)
      await fetchList()
      return { successIds: result.succeeded, failedIds: result.failed.map(({ item }) => item) }
    } finally {
      actionLoading.value = false
    }
  }

  /** 恢复单个已删除店员并刷新列表。 */
  async function restore(id: string): Promise<void> {
    actionLoading.value = true
    try {
      await restoreStaff(id)
      await fetchList()
    } finally {
      actionLoading.value = false
    }
  }

  /** 批量恢复店员，复用单条恢复接口并限制并发数。 */
  async function restoreBatch(ids: string[]): Promise<{ successIds: string[]; failedIds: string[] }> {
    const uniqueIds = [...new Set(ids.filter(Boolean))]
    if (!uniqueIds.length) return { successIds: [], failedIds: [] }
    actionLoading.value = true
    try {
      const result = await runBatch(uniqueIds, (id) => restoreStaff(id), 3)
      await fetchList()
      return { successIds: result.succeeded, failedIds: result.failed.map(({ item }) => item) }
    } finally {
      actionLoading.value = false
    }
  }

  return { list, total, loading, saving, actionLoading, page, pageSize, keyword, fetchList, save, setStatus, resetPassword, remove, removeBatch, restore, restoreBatch }
})
