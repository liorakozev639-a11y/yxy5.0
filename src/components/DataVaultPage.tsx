import { useEffect, useState, type FormEvent } from 'react';
import type { AppLockStatus, ExportFormat, ExportResult, ImportPreview, VaultStatus } from '../domain/data-vault';
import type { ApiAppLockRepository } from '../repositories/api-app-lock-repository';
import type { ApiVaultRepository } from '../repositories/api-vault-repository';

type Props = {
  repository: ApiVaultRepository;
  appLockRepository: ApiAppLockRepository;
  lockStatus: AppLockStatus;
  onLockStatusChange: (status: AppLockStatus) => void;
  onBack: () => void;
  initialStatus?: VaultStatus;
};

type SensitiveAction = { label: string; run: () => Promise<void> };

export function DataVaultPage({ repository, appLockRepository, lockStatus, onLockStatusChange, onBack, initialStatus }: Props) {
  const [status, setStatus] = useState<VaultStatus | undefined>(initialStatus);
  const [loading, setLoading] = useState(!initialStatus);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [exported, setExported] = useState<ExportResult>();
  const [preview, setPreview] = useState<ImportPreview>();
  const [verifyAction, setVerifyAction] = useState<SensitiveAction>();
  const [verifyPassword, setVerifyPassword] = useState('');
  const [settingsPassword, setSettingsPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [autoLockMinutes, setAutoLockMinutes] = useState(lockStatus.autoLockMinutes);
  const [setupPassword, setSetupPassword] = useState('');
  const [setupConfirm, setSetupConfirm] = useState('');
  const [reenablePassword, setReenablePassword] = useState('');
  const [newRecoveryKey, setNewRecoveryKey] = useState('');

  useEffect(() => {
    if (initialStatus) return;
    let active = true;
    repository.status().then((value) => { if (active) setStatus(value); }).catch((caught) => { if (active) setError(errorText(caught)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [initialStatus, repository]);

  function requireVerification(action: SensitiveAction) {
    if (lockStatus.enabled) { setVerifyPassword(''); setVerifyAction(action); }
    else void execute(action);
  }

  async function execute(action: SensitiveAction) {
    setBusy(action.label); setError(''); setMessage('');
    try { await action.run(); }
    catch (caught) { setError(errorText(caught)); }
    finally { setBusy(''); }
  }

  async function verifyAndRun(event: FormEvent) {
    event.preventDefault();
    if (!verifyAction) return;
    setBusy('verify'); setError('');
    try {
      await appLockRepository.verify(verifyPassword);
      const action = verifyAction;
      setVerifyAction(undefined);
      setVerifyPassword('');
      await execute(action);
    } catch (caught) { setError(errorText(caught)); setBusy(''); }
  }

  function startExport(format: ExportFormat) {
    const labels = { json: '导出 JSON', zip: '导出 ZIP', pdf: '导出 PDF' } as const;
    requireVerification({ label: labels[format], run: async () => {
      const result = await repository.export(format);
      setExported(result);
      setMessage(`${result.fileName} 已安全生成`);
    } });
  }

  async function inspectFile(file?: File) {
    if (!file) return;
    setBusy('inspect'); setError(''); setMessage(''); setPreview(undefined);
    try { setPreview(await repository.inspect(file)); }
    catch (caught) { setError(errorText(caught)); }
    finally { setBusy(''); }
  }

  function restore() {
    if (!preview) return;
    requireVerification({ label: '导入恢复', run: async () => {
      const result = await repository.restore(preview.id);
      setMessage(`恢复完成：新增 ${Object.values(result.result ?? {}).reduce((sum, value) => sum + value, 0)} 条数据。刷新页面后即可查看。`);
      setPreview(undefined);
    } });
  }

  function createBackup() {
    requireVerification({ label: '数据库备份', run: async () => {
      await repository.backup();
      const next = await repository.status();
      setStatus(next);
      setMessage('PostgreSQL 数据库备份已完成');
    } });
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault(); setBusy('password'); setError('');
    try {
      await appLockRepository.changePassword(settingsPassword, newPassword);
      setSettingsPassword(''); setNewPassword(''); setMessage('应用锁密码已更新');
    } catch (caught) { setError(errorText(caught)); }
    finally { setBusy(''); }
  }

  function updateLockSettings(enabled: boolean) {
    requireVerification({ label: enabled ? '开启应用锁' : '关闭应用锁', run: async () => {
      const updated = await appLockRepository.updateSettings({ enabled, autoLockMinutes });
      onLockStatusChange({ ...lockStatus, ...updated, locked: false });
      setMessage(enabled ? '应用锁已开启' : '应用锁已关闭，可随时重新开启');
    } });
  }

  function saveAutoLockMinutes() {
    requireVerification({ label: '保存自动锁定时间', run: async () => {
      const updated = await appLockRepository.updateSettings({ autoLockMinutes });
      onLockStatusChange({ ...lockStatus, ...updated, locked: false });
      setMessage(`已改为 ${autoLockMinutes} 分钟无操作后自动锁定`);
    } });
  }

  async function lockNow() {
    setBusy('lock'); setError('');
    try { await appLockRepository.lock(); onLockStatusChange({ ...lockStatus, locked: true }); }
    catch (caught) { setError(errorText(caught)); setBusy(''); }
  }

  async function setupLock(event: FormEvent) {
    event.preventDefault(); setError('');
    if (setupPassword !== setupConfirm) { setError('两次输入的密码不一致'); return; }
    setBusy('setup');
    try {
      const result = await appLockRepository.setup(setupPassword, autoLockMinutes);
      setNewRecoveryKey(result.recoveryKey);
      onLockStatusChange({ configured: true, enabled: true, locked: false, autoLockMinutes });
      setSetupPassword(''); setSetupConfirm('');
    } catch (caught) { setError(errorText(caught)); }
    finally { setBusy(''); }
  }

  async function reenableLock(event: FormEvent) {
    event.preventDefault(); setError(''); setBusy('reenable');
    try {
      await appLockRepository.unlock(reenablePassword);
      await appLockRepository.updateSettings({ enabled: true, autoLockMinutes });
      setReenablePassword('');
      onLockStatusChange({ ...lockStatus, enabled: true, locked: false, autoLockMinutes });
      setMessage('应用锁已重新开启');
    } catch (caught) { setError(errorText(caught)); }
    finally { setBusy(''); }
  }

  const summary = preview?.summary ?? {};
  return <section className="page-section vault-page">
    <div className="page-heading"><div><span className="eyebrow">LOCAL DATA CONTROL</span><h1>数据保险箱</h1><p>照片、文字、数据库备份与应用锁，都由你自己掌控。</p></div><button className="secondary-button" onClick={onBack} type="button">返回记忆</button></div>
    {loading && <div className="vault-banner">正在读取存储状态…</div>}
    {message && <div className="vault-banner is-success">{message}</div>}
    {error && <div className="error-banner">{error}</div>}

    <div className="vault-grid">
      <article className="vault-card"><div className="vault-card-heading"><span>01</span><div><h2>一键导出</h2><p>JSON 适合迁移，ZIP 同时携带原图，PDF 适合阅读与留存。</p></div></div><div className="vault-actions"><button className="secondary-button" disabled={!!busy} onClick={() => startExport('json')} type="button">导出 JSON</button><button className="secondary-button" disabled={!!busy} onClick={() => startExport('zip')} type="button">导出 ZIP</button><button className="secondary-button" disabled={!!busy} onClick={() => startExport('pdf')} type="button">导出 PDF</button></div>{exported && <div className="vault-result"><strong>{exported.fileName}</strong><span>{formatBytes(exported.size)} · SHA-256 已生成</span><a className="primary-button" href={exported.downloadUrl}>下载导出文件</a></div>}</article>

      <article className="vault-card"><div className="vault-card-heading"><span>02</span><div><h2>导入恢复</h2><p>先检查文件内容与完整性，确认预览后再合并，不会覆盖已有记录。</p></div></div><label className="file-drop"><input accept=".json,.zip,application/json,application/zip" disabled={!!busy} onChange={(event) => void inspectFile(event.target.files?.[0])} type="file" /><strong>{busy === 'inspect' ? '正在检查…' : '选择 JSON 或 ZIP 备份'}</strong><span>最大 250 MB</span></label>{preview && <div className="import-preview"><strong>检查通过，等待确认</strong><div className="preview-counts">{Object.entries(summary).map(([key, value]) => <span key={key}>{labelForCount(key)}：{value}</span>)}</div>{preview.warnings.length > 0 && <ul>{preview.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}<button className="primary-button" disabled={!!busy} onClick={restore} type="button">确认导入恢复</button></div>}</article>

      <article className="vault-card"><div className="vault-card-heading"><span>03</span><div><h2>数据库备份</h2><p>使用 PostgreSQL 原生备份格式，在本机 D 盘留下可校验快照。</p></div></div>{status && <dl className="vault-details"><div><dt>数据库</dt><dd>PostgreSQL · {status.database.host}:{status.database.port}/{status.database.database}</dd></div><div><dt>账号</dt><dd>{status.database.username}</dd></div><div><dt>最近备份</dt><dd>{backupText(status)}</dd></div></dl>}<button className="primary-button" disabled={!!busy} onClick={createBackup} type="button">{busy === '数据库备份' ? '正在备份…' : '立即创建数据库备份'}</button></article>

      <article className="vault-card"><div className="vault-card-heading"><span>04</span><div><h2>清晰的存储位置</h2><p>应用数据固定保存在项目的 D 盘目录，不写入 C 盘项目路径。</p></div></div>{status && <dl className="storage-list"><StorageRow label="全部数据" value={status.storage.root} /><StorageRow label="照片原图" value={status.storage.uploads} /><StorageRow label="数据库备份" value={status.storage.backups} /><StorageRow label="导出文件" value={status.storage.exports} /><StorageRow label="临时校验" value={status.storage.temp} /></dl>}</article>

      <article className="vault-card vault-lock-card"><div className="vault-card-heading"><span>05</span><div><h2>应用锁</h2><p>密码只在本机校验，敏感导出、恢复和备份前会要求再次验证。</p></div></div><div className="lock-status-row"><div><strong>{lockStatus.enabled ? '保护已开启' : lockStatus.configured ? '保护已暂停' : '尚未设置'}</strong><span>{lockStatus.configured ? `${autoLockMinutes} 分钟无操作后自动锁定` : '现在可创建独立密码'}</span></div><span className={lockStatus.enabled ? 'status-dot active' : 'status-dot'} /></div>
        {newRecoveryKey && <div className="recovery-key-box"><strong>恢复密钥只显示一次</strong><code>{newRecoveryKey}</code><button className="text-button" onClick={() => setNewRecoveryKey('')} type="button">我已经保存</button></div>}
        {!lockStatus.configured && <form className="password-form" onSubmit={setupLock}><h3>开启本机保护</h3><label>设置密码<input autoComplete="new-password" minLength={8} onChange={(event) => setSetupPassword(event.target.value)} required type="password" value={setupPassword} /></label><label>确认密码<input autoComplete="new-password" minLength={8} onChange={(event) => setSetupConfirm(event.target.value)} required type="password" value={setupConfirm} /></label><button className="primary-button" disabled={!!busy} type="submit">设置应用锁</button></form>}
        {lockStatus.configured && <><div className="inline-setting"><label>自动锁定<select onChange={(event) => setAutoLockMinutes(Number(event.target.value))} value={autoLockMinutes}><option value={5}>5 分钟</option><option value={15}>15 分钟</option><option value={30}>30 分钟</option><option value={60}>60 分钟</option></select></label>{lockStatus.enabled && <button className="text-button" disabled={!!busy || autoLockMinutes === lockStatus.autoLockMinutes} onClick={saveAutoLockMinutes} type="button">保存时间</button>}</div>{lockStatus.enabled ? <><div className="vault-actions"><button className="secondary-button" disabled={!!busy} onClick={() => updateLockSettings(false)} type="button">关闭应用锁</button><button className="secondary-button" disabled={!!busy} onClick={() => void lockNow()} type="button">立即锁定</button></div><form className="password-form" onSubmit={changePassword}><h3>修改密码</h3><label>当前密码<input autoComplete="current-password" onChange={(event) => setSettingsPassword(event.target.value)} required type="password" value={settingsPassword} /></label><label>新密码<input autoComplete="new-password" minLength={8} onChange={(event) => setNewPassword(event.target.value)} required type="password" value={newPassword} /></label><button className="text-button" disabled={!!busy} type="submit">保存新密码</button></form></> : <form className="password-form" onSubmit={reenableLock}><h3>重新开启保护</h3><label>应用锁密码<input autoComplete="current-password" onChange={(event) => setReenablePassword(event.target.value)} required type="password" value={reenablePassword} /></label><button className="primary-button" disabled={!!busy} type="submit">重新开启</button></form>}</>}
      </article>
    </div>

    {verifyAction && <div className="modal-backdrop"><section aria-modal="true" className="verify-dialog" role="dialog"><span className="lock-symbol">◇</span><h2>再次验证应用锁</h2><p>“{verifyAction.label}”会读取或改变你的私密数据，请输入密码确认。</p><form onSubmit={verifyAndRun}><label>应用锁密码<input autoFocus autoComplete="current-password" onChange={(event) => setVerifyPassword(event.target.value)} required type="password" value={verifyPassword} /></label><div className="dialog-actions"><button className="secondary-button" onClick={() => setVerifyAction(undefined)} type="button">取消</button><button className="primary-button" disabled={busy === 'verify'} type="submit">确认并继续</button></div></form></section></div>}
  </section>;
}

function StorageRow({ label, value }: { label: string; value: { path: string; bytes: number } }) {
  return <div><dt>{label}<small>{formatBytes(value.bytes)}</small></dt><dd>{value.path}</dd></div>;
}

function backupText(status: VaultStatus) {
  if (!status.latestBackup) return '尚未创建';
  if (status.latestBackup.status === 'FAILED') return '上次备份失败';
  if (status.latestBackup.status === 'RUNNING') return '正在备份';
  return `${new Date(status.latestBackup.createdAt).toLocaleString('zh-CN')} · ${formatBytes(status.latestBackup.fileSize ?? 0)}`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function labelForCount(key: string) {
  return ({ memories: '记忆', mediaAssets: '照片', topics: '主题', longTermCopies: '长期副本', memoryEchoes: '记忆回声', echoReflections: '回声感言' } as Record<string, string>)[key] ?? key;
}

function errorText(value: unknown) { return value instanceof Error ? value.message : '操作失败，请稍后重试'; }
