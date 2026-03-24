// 프리셋 관리 훅
import { useState, useEffect, useCallback } from 'react'
import {
  savePresets,
  loadPresets,
  type Preset,
} from '../services/storageService'

export function usePresets() {
  const [presets, setPresets] = useState<Preset[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // 초기 로드
  useEffect(() => {
    loadPresets().then((loaded) => {
      setPresets(loaded)
      setIsLoaded(true)
    })
  }, [])

  // 프리셋 추가
  const addPreset = useCallback(
    (preset: Omit<Preset, 'id' | 'createdAt'>) => {
      const newPreset: Preset = {
        ...preset,
        id: crypto.randomUUID?.() ?? String(Date.now()),
        createdAt: Date.now(),
      }
      const updated = [...presets, newPreset]
      setPresets(updated)
      savePresets(updated)
      return newPreset
    },
    [presets]
  )

  // 프리셋 삭제
  const deletePreset = useCallback(
    (id: string) => {
      const updated = presets.filter((p) => p.id !== id)
      setPresets(updated)
      savePresets(updated)
    },
    [presets]
  )

  return { presets, isLoaded, addPreset, deletePreset }
}
