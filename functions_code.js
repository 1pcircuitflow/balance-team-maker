const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

/**
 * [방장 실시간 알림 트리거]
 * notifications 컬렉션에 PENDING 상태의 새 문서가 들어오면 FCM을 발송합니다.
 */
exports.sendHostNotification = functions.firestore
    .document('notifications/{notificationId}')
    .onCreate(async (snap, context) => {
        const data = snap.data();

        if (data.status !== 'PENDING' || !data.to) {
            return null;
        }

        const message = {
            notification: {
                title: data.title || '새 알림',
                body: data.body || '내용이 없습니다.'
            },
            data: {
                roomId: data.roomId || '',
                type: 'NEW_APPLICANT'
            },
            token: data.to
        };

        try {
            const response = await admin.messaging().send(message);
            console.log('Successfully sent message:', response);

            // 발송 성공 후 상태 업데이트
            return snap.ref.update({
                status: 'SENT',
                sentAt: admin.firestore.FieldValue.serverTimestamp(),
                messageId: response
            });
        } catch (error) {
            console.error('Error sending message:', error);

            // 발송 실패 시 상태 업데이트
            return snap.ref.update({
                status: 'FAILED',
                error: error.message,
                failedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
    });
