import { useState, type FormEvent, type ReactNode } from 'react';
import type { AppLockStatus } from '../domain/data-vault';
import type { ApiAppLockRepository } from '../repositories/api-app-lock-repository';

type Props = {
  children: ReactNode;
  repository: ApiAppLockRepository;
  status: AppLockStatus;
  onStatusChange: (status: AppLockStatus) => void;
  onSkip: () => void;
};

export function AppLockGate({ children, repository, status, onStatusChange, onSkip }: Props) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [nextRecoveryKey, setNextRecoveryKey] = useState('');
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if ((status.configured && (!status.enabled || !status.locked)) || nextRecoveryKey) {
    if (!nextRecoveryKey) return <>{children}</>;
    return <main className="lock-gate"><section className="lock-card recovery-card"><span className="lock-symbol">◇</span><h1>恢复密钥已生成</h1><p>恢复密钥只显示一次。请把它保存到安全的位置，忘记密码时需要使用。</p><code>{nextRecoveryKey}</code><button className="primary-button" onClick={() => { setNextRecoveryKey(''); onStatusChange({ ...status, configured: true, enabled: true, locked: false }); }} type="button">我已经保存</button></section></main>;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!status.configured && password !== confirmPassword) { setError('两次输入的密码不一致'); return; }
    setBusy(true);
    try {
      if (!status.configured) {
        const result = await repository.setup(password, 30);
        setNextRecoveryKey(result.recoveryKey);
      } else if (recoveryMode) {
        const result = await repository.recover(recoveryKey.trim(), password);
        setNextRecoveryKey(result.recoveryKey);
      } else {
        await repository.unlock(password);
        onStatusChange({ ...status, enabled: true, locked: false });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '操作失败，请重试');
    } finally { setBusy(false); }
  }

  return <main className="lock-gate"><section className="lock-card"><span className="lock-symbol">✦</span><span className="eyebrow">PRIVATE MEMORY ARCHIVE</span><h1>{status.configured ? (recoveryMode ? '恢复应用锁' : '欢迎回来') : '设置应用锁'}</h1><p>{status.configured ? '解锁后才能进入你的照片记忆本。' : '使用独立密码保护本机上的照片与文字。你也可以稍后在数据保险箱中开启。'}</p>
    {!status.configured && <div className="lock-note"><strong>恢复密钥只显示一次</strong><span>请离线保存，它是忘记密码后的唯一恢复凭证。</span></div>}
    <form onSubmit={submit}>
      {recoveryMode && <label>恢复密钥<input autoComplete="off" onChange={(event) => setRecoveryKey(event.target.value)} required value={recoveryKey} /></label>}
      <label>{recoveryMode ? '设置新密码' : '应用锁密码'}<input autoComplete={status.configured ? 'current-password' : 'new-password'} minLength={status.configured && !recoveryMode ? 1 : 8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label>
      {!status.configured && <label>确认密码<input autoComplete="new-password" minLength={8} onChange={(event) => setConfirmPassword(event.target.value)} required type="password" value={confirmPassword} /></label>}
      {error && <div className="form-error">{error}</div>}
      <button className="primary-button" disabled={busy} type="submit">{busy ? '正在处理…' : status.configured ? (recoveryMode ? '使用恢复密钥重设' : '解锁记忆本') : '开启应用锁'}</button>
    </form>
    {status.configured ? <button className="text-button" onClick={() => { setRecoveryMode((value) => !value); setError(''); }} type="button">{recoveryMode ? '返回密码解锁' : '使用恢复密钥'}</button> : <button className="text-button" onClick={onSkip} type="button">暂不设置</button>}
  </section></main>;
}
