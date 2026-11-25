import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

import { BrandLogo } from '../auth/BrandLogo'
import { LoginForm } from '../auth/LoginForm'
import { Workflow } from '../auth/WorkFlow'
import { login } from '../auth/authService'
import { DEMO_LOGIN_URL, IS_DEMO, PRODUCTION_ENABLED, PRODUCTION_LOGIN_URL } from '../../lib/environment'

export function LoginPage({ onLoginSuccess, initialCredentials }) {
  const demoCredentials = IS_DEMO ? initialCredentials : undefined
  const navigate = useNavigate()

  const handleLogin = async (email, password) => {
    const result = await login(email, password)

    if (result.success) {
      onLoginSuccess?.(result.user)
    }

    return result
  }

  return (
    <main className="login-shell font-sans antialiased">
      <section className="login-visual-panel">
        <div className="panel-noise" aria-hidden="true" />

        <header className="visual-header">
          <BrandLogo tone="dark" />
          <span className="visual-header__meta">WORKFLOW / 01</span>
        </header>

        <div className="visual-content">
          <div className="hero-copy">
            <span className="hero-kicker">
              <i /> TECHNOLOGY ENTERPRISE WORKFLOW
            </span>

            <h2>
              Phê duyệt rõ ràng.
                

              <em>Vận hành an tâm.</em>
            </h2>

            <p>
              Hệ thống Phê duyệt Quy trình Doanh nghiệp Công nghệ — FlowRequest.
            </p>
          </div>

          <Workflow />
        </div>

        <footer className="visual-footer">
          <span className="secure-status">
            <i /> Secure internal environment
          </span>
          <span>FlowRequest v1.4.0</span>
        </footer>
      </section>

      <section className="login-form-panel">
        <div
          className="form-panel__halo form-panel__halo--one"
          aria-hidden="true"
        />

        <div
          className="form-panel__halo form-panel__halo--two"
          aria-hidden="true"
        />

        <div className="form-panel__inner">
          <header className="form-panel__brand">
            <BrandLogo tone="light" compact />
            <button
              className="public-back-button"
              type="button"
              onClick={() => navigate('/')}
            >
              <ArrowLeft size={16} aria-hidden="true" />
              <span>Public</span>
            </button>
          </header>

          <LoginForm
            key={demoCredentials?.email ?? 'empty'}
            onLogin={handleLogin}
            initialCredentials={demoCredentials}
          />

          <div className="form-options">
            <a className="public-back-button" href={IS_DEMO && PRODUCTION_ENABLED ? PRODUCTION_LOGIN_URL : DEMO_LOGIN_URL}>
              {IS_DEMO && PRODUCTION_ENABLED ? <><ArrowLeft size={16} aria-hidden="true" />Quay lại đăng nhập thực tế</> : 'Trải nghiệm Demo'}
            </a>
          </div>

          <div className="form-panel__footer">
            FLOWREQUEST SYSTEMS <span>•</span> AUTHENTICATED ACCESS
          </div>
        </div>
      </section>
    </main>
  )
}
