import cron from 'node-cron';
import prisma from '../services/prisma.service.js';
import * as emailService from '../services/email.service.js';

// Runs every day at 12:00 PM (Noon)
export const initCronJobs = () => {
  cron.schedule('0 12 * * *', async () => {
    console.log("⏰ Running daily billing cron job...");

    try {
      const today = new Date();
      const threeDaysFromNow = new Date(today.getTime() + (3 * 24 * 60 * 60 * 1000));

      // 1. FIND SERVERS EXPIRING IN EXACTLY 3 DAYS
      const expiringOrders = await prisma.order.findMany({
        where: {
          status: 'ACTIVE',
          paidUntil: {
            gte: new Date(threeDaysFromNow.setHours(0,0,0,0)),
            lte: new Date(threeDaysFromNow.setHours(23,59,59,999)),
          }
        },
        include: { user: true, service: true }
      });

      for (const order of expiringOrders) {
        if (order.service) {
           // Create a new function in email.service.js for this
           await emailService.sendMail(
             order.user.email, 
             "Action Required: Server Expiring Soon", 
             `Your server ${order.service.hostname} will expire in 3 days. Please ensure your billing info is up to date.`
           );
        }
      }

      // 2. FIND SERVERS THAT EXPIRED YESTERDAY (Time to Shutdown)
      const expiredOrders = await prisma.order.findMany({
        where: {
          status: 'ACTIVE',
          paidUntil: { lte: today }
        },
        include: { user: true, service: true }
      });

      for (const order of expiredOrders) {
         // Suspend the order
         await prisma.order.update({ where: { id: order.id }, data: { status: 'SUSPENDED' } });
         
         if (order.service) {
           await prisma.service.update({ where: { id: order.service.id }, data: { status: 'SUSPENDED' } });
           
           // TODO: Call your Proxmox service here to physically STOP the VM!
           // await proxmoxService.controlVm(order.service.vmid, order.userId, 'stop');

           await emailService.sendMail(
             order.user.email, 
             "Server Suspended", 
             `Your server ${order.service.hostname} has been suspended due to non-payment. Please pay your invoice to restore service.`
           );
         }
      }

    } catch (err) {
      console.error("Cron Job Error:", err);
    }
  });
};