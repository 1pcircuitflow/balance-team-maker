import { useState, useEffect, useRef, useCallback } from 'react';
import { ChatMessage } from '../types';
import { sendChatMessage, subscribeToChatMessages } from '../services/firebaseService';

export const useChat = (
  roomId: string | undefined,
  currentUserId: string,
  userNickname: string,
  isActive: boolean,
  isRoomExpired: boolean,
  userPhotoUrl?: string,
) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevMessageCount = useRef(0);

  // 구독: isActive && roomId 있을 때만
  useEffect(() => {
    if (!isActive || !roomId) return;

    const unsubscribe = subscribeToChatMessages(
      roomId,
      100,
      (msgs) => {
        setMessages(msgs);
      },
      (error) => {
        console.error('Chat subscription error:', error);
      }
    );

    return () => unsubscribe();
  }, [isActive, roomId]);

  // 새 메시지 도착 시 자동 스크롤
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (messages.length > prevMessageCount.current) {
      timer = setTimeout(() => {
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: messages.length - prevMessageCount.current > 5 ? 'auto' : 'smooth',
        });
      }, 50);
    }
    prevMessageCount.current = messages.length;
    return () => clearTimeout(timer);
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    if (!roomId || !inputText.trim() || sending || isRoomExpired) return;
    const text = inputText.trim();
    setInputText('');
    setSending(true);
    try {
      await sendChatMessage(roomId, currentUserId, userNickname, text, userPhotoUrl);
    } catch (e) {
      console.error('Failed to send message:', e);
      setInputText(text);
    } finally {
      setSending(false);
    }
  }, [roomId, inputText, sending, isRoomExpired, currentUserId, userNickname, userPhotoUrl]);

  return {
    messages,
    inputText,
    setInputText,
    sending,
    handleSend,
    scrollRef,
  };
};
