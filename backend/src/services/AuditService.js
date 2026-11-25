import AuditLog from '../models/Auditlog.js'
export const createAuditLog = async(req,{action,targetEntity,targetId,oldValue = null,newValue = null}) => {
    try {
        //Lấy ip chuẩn kể cả khi chạy qua Cloudflare Proxy(Máy chủ trung gian)
        const clientIp = req.ip || 'UNKNOWN'
        const userAgent = req.headers['user-agent'] || 'UNKNOWN'

        await AuditLog.create({
            actor:req.user._id,
            action,
            targetEntity,
            targetId,
            changes: {newValue,oldValue},
            ipAddress:clientIp, //Gắn vào đây khi đã xong 
            userAgent
        });
    } catch (error) {
        console.error('[AuditLog_Error]: Không thể ghi nhật ký hệ thống:', error.message)
    }
}
