import { useState } from 'react'
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from 'lucide-react'

export function LoginForm({ onLogin, initialCredentials }) {
  const [email, setEmail] = useState(initialCredentials?.email ?? '')
  const [password, setPassword] = useState(initialCredentials?.password ?? '')
  const [remember, setRemember] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()

    setError('')
    setNotice('')
    setSuccess('')

    if (!email.trim() || !password.trim()) {
      setError('Vui lòng nhập đầy đủ email công ty và mật khẩu.')
      return
    }

    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Vui lòng kiểm tra lại định dạng email công ty.')
      return
    }

    setLoading(true)

    try {
      const result = await onLogin(email, password, remember)

      if (!result.success) {
        setError(result.message)
        return
      }

      setSuccess(
        `Đăng nhập thành công. Xin chào ${result.user.name}.`,
      )
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = () => {
    setError('')
    setSuccess('')
    setNotice(
      'Yêu cầu khôi phục mật khẩu sẽ được chuyển đến Quản trị viên IT.',
    )
  }

  return (
    <form
      className="login-form"
      onSubmit={handleSubmit}
      noValidate
    >
      <div className="form-heading">
        <span className="section-kicker">
          EMPLOYEE ACCESS
        </span>

        <h1>Đăng nhập hệ thống nội bộ</h1>

        <p>
          Sử dụng tài khoản email công nghệ được cấp bởi quản trị viên IT.
        </p>
      </div>

      <div className="field-stack">
        <label className="field-group">
          <span className="field-label">Email công ty</span>

          <span className="field-control">
            <Mail size={18} aria-hidden="true" />

            <input
              type="email"
              autoComplete="username"
              placeholder="username@tech-enterprise.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-label="Email công ty"
            />
          </span>
        </label>

        <label className="field-group">
          <span className="field-label">Mật khẩu</span>

          <span className="field-control">
            <LockKeyhole size={18} aria-hidden="true" />

            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Nhập mật khẩu của bạn"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-label="Mật khẩu"
            />

            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={
                showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'
              }
            >
              {showPassword ? (
                <EyeOff size={18} />
              ) : (
                <Eye size={18} />
              )}
            </button>
          </span>
        </label>
      </div>

      <div className="form-options">
        <label className="remember-option">
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
          />

          <span className="custom-checkbox" aria-hidden="true" />

          <span>Nhớ phiên đăng nhập</span>
        </label>

        <button
          type="button"
          className="forgot-link"
          onClick={handleForgotPassword}
        >
          Quên mật khẩu?
        </button>
      </div>

      <button
        className="submit-button"
        type="submit"
        disabled={loading}
      >
        <span>
          {loading ? 'Đang kiểm tra...' : 'Đăng nhập'}
        </span>

        {loading ? (
          <span
            className="button-loader"
            aria-hidden="true"
          />
        ) : (
          <ArrowRight size={18} />
        )}
      </button>

      {error && (
        <p
          className="form-message form-message--error"
          role="alert"
        >
          {error}
        </p>
      )}

      {success && (
        <p
          className="form-message form-message--success"
          role="status"
        >
          {success}
        </p>
      )}

      {notice && (
        <p
          className="form-message form-message--notice"
          role="status"
        >
          {notice}
        </p>
      )}

      <div className="security-note">
        <div className="security-note__rule" />

        <div className="security-note__body">
          <span className="security-note__icon">
            <ShieldCheck size={17} />
          </span>

          <p>
            Truy cập hệ thống được giám sát bởi chính sách bảo mật
            nội bộ doanh nghiệp. Vui lòng không chia sẻ thông tin
            tài khoản.
          </p>
        </div>
      </div>

      <p className="account-note">
        Tài khoản được cấp bởi Quản trị viên / HR
      </p>
    </form>
  )
}
