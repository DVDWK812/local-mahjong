import { useState } from 'react';
import { createConfig, validateConfig } from '../game/xuezhan/config';
import { downloadXz } from './XuezhanScreen';

/** Existing import/export capabilities live in diagnostics, not the beginner settings. */
export function XuezhanConfigTools() {
  const [text,setText]=useState(''), [message,setMessage]=useState('');
  return <details><summary>配置导入／导出工具</summary><p>导入先校验再保存为赛前草稿；不会修改进行中的比赛或存档。</p>
    <textarea aria-label="导入血战配置" value={text} onChange={e=>setText(e.target.value)}/>
    <button onClick={()=>{try {if(text.length>50000)throw new Error('配置超过大小限制'); const c=validateConfig(JSON.parse(text));localStorage.setItem('local-mahjong.xuezhan.config.v1',JSON.stringify(c));setMessage('已验证并保存赛前草稿');}catch(e){setMessage(String(e));}}}>验证并保存草稿</button>
    <button onClick={()=>{try {const raw=localStorage.getItem('local-mahjong.xuezhan.config.v1');downloadXz('血战配置.json',raw?validateConfig(JSON.parse(raw)):createConfig());}catch(e){setMessage(String(e));}}}>导出配置</button>
    <p role="status">{message}</p>
  </details>;
}
