import { apiRequest } from '../../lib/api'
import { TOKEN_KEY, USER_KEY } from '../../lib/environment'

export const SUPPORTED_LOGIN_ROLES = [
  'employee',
  'manager',
  'hr_admin',
  'system_admin',
  'accountant',
  'director',
]

export async function login(email, password) {
  try {
    const result = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email: email.trim(), password },
    })

    if (!result.user || !result.token) {
      throw new Error('Phản hồi đăng nhập từ máy chủ không hợp lệ.')
    }

    const role = result.user.role.toLowerCase()
    if (!SUPPORTED_LOGIN_ROLES.includes(role)) {
      return {
        success: false,
        message: 'Vai trò này hiện chưa được hỗ trợ đăng nhập trên giao diện.',
      }
    }

    const user = {
      id: result.user.id,
      name: result.user.name,
      email: result.user.email,
      role,
      department: result.user.department,
    }

    localStorage.setItem(USER_KEY, JSON.stringify(user))
    localStorage.setItem(TOKEN_KEY, result.token)

    return {
      success: true,
      user,
    }
  } catch (error) {
    return {
      success: false,
      message: error.message,
    }
  }
}
