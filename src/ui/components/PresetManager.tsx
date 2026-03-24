// 프리셋 관리 컴포넌트
// 프리셋 저장, 불러오기, 삭제
import React, { useState } from 'react'
import { usePresets } from '../hooks/usePresets'
import type { Preset } from '../services/storageService'

interface PresetManagerProps {
  token: string
  selectedDbId: string
  onLoadPreset: (preset: Preset) => void
}

export function PresetManager({
  token,
  selectedDbId,
  onLoadPreset,
}: PresetManagerProps) {
  const { presets, addPreset, deletePreset } = usePresets()
  const [newName, setNewName] = useState('')
  const [showSaveForm, setShowSaveForm] = useState(false)

  const handleSave = () => {
    if (!newName.trim()) return

    addPreset({
      name: newName.trim(),
      databaseId: selectedDbId,
      databaseName: '',
      mappings: [],
      mode: 'random',
      token,
    })

    setNewName('')
    setShowSaveForm(false)
  }

  return (
    <div>
      {/* 프리셋 저장 */}
      <div style={{ marginBottom: 12 }}>
        {showSaveForm ? (
          <div className="field-group">
            <label className="field-label">프리셋 이름</label>
            <input
              className="field-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="예: 쇼핑몰 상품 데이터"
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
            <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={!newName.trim() || !selectedDbId}
              >
                저장
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setShowSaveForm(false)}
              >
                취소
              </button>
            </div>
          </div>
        ) : (
          <button
            className="btn btn-secondary btn-block"
            onClick={() => setShowSaveForm(true)}
            disabled={!selectedDbId}
          >
            현재 설정을 프리셋으로 저장
          </button>
        )}
      </div>

      {/* 프리셋 목록 */}
      {presets.length === 0 ? (
        <div className="empty-state">
          저장된 프리셋이 없습니다.
          <br />
          설정을 완료한 후 프리셋으로 저장해보세요.
        </div>
      ) : (
        presets.map((preset) => (
          <div key={preset.id} className="preset-card">
            <div>
              <div className="preset-name">{preset.name}</div>
              <div className="preset-meta">
                {new Date(preset.createdAt).toLocaleDateString('ko-KR')}
              </div>
            </div>
            <div className="preset-actions">
              <button
                className="btn btn-primary btn-small"
                onClick={() => onLoadPreset(preset)}
              >
                불러오기
              </button>
              <button
                className="btn btn-danger btn-small"
                onClick={() => deletePreset(preset.id)}
              >
                삭제
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
