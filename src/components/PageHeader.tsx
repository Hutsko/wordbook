// no React import needed with modern JSX runtime

type PageHeaderProps = {
  title: string
  primaryAction?: { label: string; onClick: () => void }
}

export default function PageHeader({ title, primaryAction }: PageHeaderProps) {
  return (
    <header className="header">
      <h1 className="title">{title}</h1>
      {primaryAction && (
        <button className="create-btn" onClick={primaryAction.onClick}>
          {primaryAction.label}
        </button>
      )}
    </header>
  )
}


