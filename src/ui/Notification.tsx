import { useEffect } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fontSize } from '../lib/utils';

type NotificationType = 'success' | 'error' | 'info';

interface NotificationProps {
  type: NotificationType;
  message: string;
  onClose: () => void;
}

const config = {
  success: {
    icon: CheckCircle,
    color: 'text-green-600 dark:text-green-400',
    line: 'bg-green-600 dark:bg-green-500',
    bg: 'bg-green-100/60 dark:bg-green-500/10',
    border: 'border-green-300/50 dark:border-green-500/20',
  },
  error: {
    icon: XCircle,
    color: 'text-red-600 dark:text-red-400',
    line: 'bg-red-600 dark:bg-red-500',
    bg: 'bg-red-100/60 dark:bg-red-500/10',
    border: 'border-red-300/50 dark:border-red-500/20',
  },
  info: {
    icon: Info,
    color: 'text-blue-600 dark:text-blue-400',
    line: 'bg-blue-600 dark:bg-blue-500',
    bg: 'bg-blue-100/60 dark:bg-blue-500/10',
    border: 'border-blue-300/50 dark:border-blue-500/20',
  },
};

export default function Notification({ type, message, onClose }: NotificationProps) {
  const { icon: Icon, color, line, bg, border } = config[type];

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 2500);

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: 400, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 400, opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed top-4 right-4 z-[100]"
      >
        <div className={`bg-white dark:bg-gray-900 border ${border} rounded-xl shadow-xl overflow-hidden min-w-[240px] max-w-[280px] sm:min-w-[300px] sm:max-w-md`}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: '100%' }}
            transition={{ duration: 2.5, ease: 'linear' }}
            className={`h-1 ${line}`}
          />
          
          <div className="flex items-start gap-3 p-4 sm:p-4">
            <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${color} flex-shrink-0 mt-0.5`} />
            <p className="text-gray-900 dark:text-white flex-1" style={{ fontSize: fontSize.xs }}>{message}</p>
            <button
              onClick={onClose}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
            >
              <X className="w-3 h-3 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
