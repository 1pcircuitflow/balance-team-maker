import React, { useRef, useEffect, useCallback } from 'react';
import { ChatMessage } from '../types';
import { Z_INDEX } from '../constants';
import { ChatBubbleIcon, SendIcon } from '../Icons';

interface ChatTabProps {
  messages: ChatMessage[];
  inputText: string;
  setInputText: (v: string) => void;
  sending: boolean;
  handleSend: () => void;
  scrollRef: React.RefObject<HTMLDivElement>;
  currentUserId: string;
  isExpired: boolean;
  isApproved: boolean;
  t: (key: string, ...args: any[]) => string;
  onAvatarPress?: (userId: string) => void;
}

const formatDateSeparator = (dateStr: string, t: (key: string) => string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (msgDate.getTime() === today.getTime()) return t('chatToday');
  if (msgDate.getTime() === yesterday.getTime()) return t('chatYesterday');
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const formatTime = (dateStr: string): string => {
  const d = new Date(dateStr);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const getDateKey = (dateStr: string): string => {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

const getInitial = (name: string): string => {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
};

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
  'bg-purple-500', 'bg-cyan-500', 'bg-orange-500', 'bg-pink-500',
];

const getAvatarColor = (senderId: string): string => {
  let hash = 0;
  for (let i = 0; i < senderId.length; i++) {
    hash = senderId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

/** 같은 사람이 5분 이내 연속 메시지인지 체크 */
const isSameGroup = (prev: ChatMessage, curr: ChatMessage): boolean => {
  if (prev.senderId !== curr.senderId) return false;
  if (prev.type === 'SYSTEM' || curr.type === 'SYSTEM') return false;
  const diff = new Date(curr.createdAt).getTime() - new Date(prev.createdAt).getTime();
  return diff < 5 * 60 * 1000; // 5분
};

export const ChatTab: React.FC<ChatTabProps> = React.memo(({
  messages,
  inputText,
  setInputText,
  sending,
  handleSend,
  scrollRef,
  currentUserId,
  isExpired,
  isApproved,
  t,
  onAvatarPress,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // textarea auto-resize
  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '21px';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputText, adjustTextareaHeight]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // 비승인 상태
  if (!isApproved) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-16 animate-in fade-in duration-300">
        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
          <ChatBubbleIcon size={24} className="text-slate-300 dark:text-slate-600" />
        </div>
        <p className="text-[13px] font-medium text-slate-400 dark:text-slate-500 tracking-tight text-center whitespace-pre-line">
          {t('chatNotApproved')}
        </p>
      </div>
    );
  }

  let lastDateKey = '';

  return (
    <div className="flex flex-col flex-1 min-h-0 animate-in fade-in duration-300">
      {/* 메시지 목록 */}
      <div
        ref={scrollRef as React.RefObject<HTMLDivElement>}
        className="flex-1 overflow-y-auto pb-4"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <ChatBubbleIcon size={24} className="text-slate-300 dark:text-slate-600" />
            </div>
            <p className="text-[13px] font-medium text-slate-400 dark:text-slate-500 tracking-tight text-center whitespace-pre-line">
              {t('chatEmpty')}
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.senderId === currentUserId;
            const isSystem = msg.type === 'SYSTEM';
            const dateKey = getDateKey(msg.createdAt);
            const showDateSep = dateKey !== lastDateKey;
            lastDateKey = dateKey;

            // 그룹핑: 이전/다음 메시지와 비교
            const prev = idx > 0 ? messages[idx - 1] : null;
            const next = idx < messages.length - 1 ? messages[idx + 1] : null;
            const isGroupedWithPrev = prev && getDateKey(prev.createdAt) === dateKey && isSameGroup(prev, msg);
            const isGroupedWithNext = next && getDateKey(next!.createdAt) === dateKey && isSameGroup(msg, next!);

            // 그룹 내 첫 메시지: 아바타+이름 표시
            const showAvatar = !isMe && !isSystem && !isGroupedWithPrev;
            // 그룹 내 마지막 메시지: 시간 표시
            const showTime = !isSystem && !isGroupedWithNext;

            // 그룹 간격: 그룹 내는 좁게, 그룹 간은 넓게
            const topMargin = showDateSep ? '' : (isGroupedWithPrev ? 'mt-0.5' : 'mt-3');

            return (
              <React.Fragment key={msg.id}>
                {/* 날짜 구분선 */}
                {showDateSep && (
                  <div className="flex items-center gap-3 py-4">
                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                    <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-[11px] font-medium text-slate-400 dark:text-slate-500 shrink-0">
                      {formatDateSeparator(msg.createdAt, t)}
                    </span>
                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                  </div>
                )}

                {/* 시스템 메시지 */}
                {isSystem ? (
                  <div className={`flex items-center justify-center py-1.5 ${topMargin}`}>
                    <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-[12px] font-medium text-slate-400 dark:text-slate-500">
                      {msg.text}
                    </span>
                  </div>
                ) : (
                  /* 일반 메시지 */
                  <div className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'} ${topMargin}`}>
                    {/* 아바타 (상대방, 그룹 첫 메시지만) */}
                    {!isMe ? (
                      showAvatar ? (
                        <button
                          onClick={() => onAvatarPress?.(msg.senderId)}
                          className="w-9 h-9 rounded-full shrink-0 overflow-hidden active:scale-90 transition-all"
                        >
                          {msg.senderPhotoUrl ? (
                            <img src={msg.senderPhotoUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className={`w-full h-full ${getAvatarColor(msg.senderId)} flex items-center justify-center text-[13px] font-bold text-white`}>
                              {getInitial(msg.senderName)}
                            </div>
                          )}
                        </button>
                      ) : (
                        <div className="w-9 shrink-0" />
                      )
                    ) : (
                      <div className="w-0 shrink-0" />
                    )}

                    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[70%]`}>
                      {/* 이름 (상대방, 그룹 첫 메시지만) */}
                      {showAvatar && (
                        <span className="text-[12px] font-medium text-slate-400 dark:text-slate-500 mb-0.5 ml-1">
                          {msg.senderName}
                        </span>
                      )}

                      <div className={`flex items-end gap-1.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                        {/* 말풍선 */}
                        <div
                          className={`px-3.5 py-2.5 rounded-2xl text-[15px] font-medium leading-relaxed break-words whitespace-pre-wrap ${
                            isMe
                              ? 'bg-blue-500 text-white rounded-br-md'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-md'
                          }`}
                        >
                          {msg.text}
                        </div>

                        {/* 시간 (그룹 마지막만) */}
                        {showTime ? (
                          <span className="text-[12px] font-medium text-slate-300 dark:text-slate-600 shrink-0">
                            {formatTime(msg.createdAt)}
                          </span>
                        ) : (
                          <span className="w-[30px] shrink-0" />
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })
        )}
      </div>

      {/* 입력창 */}
      <div
        className="shrink-0 pt-2 pb-4 bg-white dark:bg-slate-950"
        style={{ zIndex: Z_INDEX.CHAT_INPUT }}
      >
        {isExpired ? (
          <div className="flex items-center justify-center py-3 bg-slate-50 dark:bg-slate-900 rounded-2xl">
            <span className="text-[14px] font-medium text-slate-400 dark:text-slate-500">
              {t('chatExpired')}
            </span>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <div className="flex-1 bg-slate-200 dark:bg-slate-800 rounded-full px-4 py-2.5">
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('chatInputPlaceholder')}
                maxLength={500}
                rows={1}
                className="w-full bg-transparent text-[15px] font-medium text-slate-900 dark:text-white outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 resize-none overflow-hidden block"
                style={{ maxHeight: '120px', lineHeight: '21px' }}
              />
            </div>
            {inputText.length >= 200 && (
              <span className={`text-[10px] font-medium shrink-0 mb-2 ${inputText.length >= 450 ? 'text-rose-500' : 'text-slate-400 dark:text-slate-500'}`}>
                {inputText.length}/500
              </span>
            )}
            <button
              onClick={handleSend}
              disabled={!inputText.trim() || sending}
              className={`p-1 mb-0.5 transition-all active:scale-90 disabled:active:scale-100 shrink-0 ${inputText.trim() ? 'text-blue-500' : 'text-slate-300 dark:text-slate-600'}`}
            >
              {sending ? (
                <span className="inline-block w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <SendIcon size={24} />
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
