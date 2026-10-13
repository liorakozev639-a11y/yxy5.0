import type { EchoReflection, MemoryEcho } from './memory-echo';

export function saveEchoReflection(echoes: MemoryEcho[], echoId: string, reflection: EchoReflection): MemoryEcho[] {
  return echoes.map((echo) => echo.id === echoId ? { ...echo, reflection } : echo);
}

export function dismissEcho(echoes: MemoryEcho[], echoId: string): MemoryEcho[] {
  return echoes.map((echo) => echo.id === echoId ? { ...echo, status: 'DISMISSED' } : echo);
}

export function shouldApplyMemoryReflections(requestedMemoryId: string, selectedMemoryId?: string): boolean {
  return requestedMemoryId === selectedMemoryId;
}
