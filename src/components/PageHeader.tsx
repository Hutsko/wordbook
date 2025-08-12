import { Link } from 'react-router-dom'

type PageHeaderProps = {
  title: string
  primaryAction?: { label: string; onClick: () => void }
  showSettings?: boolean
}

export default function PageHeader({ title, primaryAction, showSettings = false }: PageHeaderProps) {
  return (
    <header className="header">
      <h1 className="title">{title}</h1>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        {showSettings && (
          <Link to="/settings" className="btn" style={{ textDecoration: 'none' }}>
            ⚙️ Settings
          </Link>
        )}
        {primaryAction && (
          <button className="create-btn" onClick={primaryAction.onClick}>
            {primaryAction.label}
          </button>
        )}
      </div>
    </header>
  )
}


