import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createAdmin, deleteAdmin, getAdminList, resetAdminPassword, restoreAdmin, updateAdminRole, updateAdminStatus } from '@/api/admin'
import type { AdminCreateDTO, AdminInfo, AdminPageResult, AdminResetPasswordDTO, AdminRole, AdminStatus } from '@/types/admin'

export const useAdminStore = defineStore('admin', () => {
  const list = ref<AdminPageResult['list']>([])
  const total = ref(0)
  const loading = ref(false)
  const saving = ref(false)
  const actionLoading = ref(false)
  const page = ref(1)
  const pageSize = ref(10)

  /** 加载管理员分页列表。 */
  async function fetchList(): Promise<void> {
    loading.value = true
    try {
      const result = await getAdminList(page.value, pageSize.value)
      list.value = result.list
      total.value = result.total
    } finally {
      loading.value = false
    }
  }

  /** 新增管理员。 */
  async function save(payload: AdminCreateDTO): Promise<void> {
    saving.value = true
    try {
      await createAdmin(payload)
      await fetchList()
    } finally {
      saving.value = false
    }
  }

  /** 修改管理员角色。 */
  async function setRole(admin: AdminInfo, role: AdminRole): Promise<void> {
    actionLoading.value = true
    try {
      await updateAdminRole(admin.id, role)
      admin.role = role
    } finally {
      actionLoading.value = false
    }
  }

  /** 更新管理员启用状态。 */
  async function setStatus(admin: AdminInfo, status: AdminStatus): Promise<void> {
    actionLoading.value = true
    try {
      await updateAdminStatus(admin.id, status)
      admin.status = status
    } finally {
      actionLoading.value = false
    }
  }

  /** 重置管理员密码。 */
  async function resetPassword(id: string, payload: AdminResetPasswordDTO): Promise<void> {
    actionLoading.value = true
    try {
      await resetAdminPassword(id, payload)
    } finally {
      actionLoading.value = false
    }
  }

  /** 软删除管理员并刷新当前页。 */
  async function remove(id: string): Promise<void> {
    actionLoading.value = true
    try {
      await deleteAdmin(id)
      await fetchList()
    } finally {
      actionLoading.value = false
    }
  }

  /** 恢复管理员并刷新当前页。 */
  async function restore(id: string): Promise<void> {
    actionLoading.value = true
    try {
      await restoreAdmin(id)
      await fetchList()
    } finally {
      actionLoading.value = false
    }
  }

  return { list, total, loading, saving, actionLoading, page, pageSize, fetchList, save, setRole, setStatus, resetPassword, remove, restore }
})
