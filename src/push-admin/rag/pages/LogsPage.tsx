import { useState } from 'react'
import type { Origin } from '../api/types'
import { ConversationDialog, ConversationTable } from '../ConversationList'
import { usePaged } from '../hooks'
import type { PageProps } from '../ui'

export default function LogsPage({ api }: PageProps) {
  const [origin, setOrigin] = useState<Origin | 'all'>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const paged = usePaged(cursor => api.listInteractions(origin, cursor), origin)

  return <>
    <div className="toolbar">
      <label className="field">紀錄類型<select value={origin} onChange={event => setOrigin(event.target.value as Origin | 'all')}>
        <option value="all">全部</option>
        <option value="query">人工試問</option>
        <option value="evaluation">自動評測</option>
      </select></label>
    </div>
    <ConversationTable label="互動紀錄" paged={paged} showUser onOpen={setOpenId} />
    <p className="caption">問題和回答保存 180 天，之後只留下時間、結果、知識版本和費用。</p>
    <ConversationDialog api={api} id={openId} onClose={() => setOpenId(null)} />
  </>
}
