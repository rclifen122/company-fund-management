import { createElement } from 'react';
import { motion as Motion } from 'framer-motion';

const StatCard = ({ title, value, change, changeType, icon: Icon, subValue, onClick }) => {
  const isPositive = changeType === 'positive';
  const isNegative = changeType === 'negative';

  const iconBgMap = {
    positive: 'from-emerald-400 to-teal-500',
    negative: 'from-rose-400 to-pink-500',
    neutral: 'from-amber-400 to-orange-500',
  };

  const iconBg = iconBgMap[changeType] || 'from-gray-400 to-gray-500';

  return (
    <Motion.button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={`w-full overflow-hidden rounded-xl border border-gray-100 bg-white text-left shadow-card transition-shadow duration-250 dark:border-gray-700/50 dark:bg-gray-800/80 ${onClick ? 'cursor-pointer hover:shadow-card-hover focus:outline-none focus:ring-2 focus:ring-indigo-500' : 'cursor-default'}`}
    >
      <div className="p-3 sm:p-5">
        <div className="flex items-center">
          <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br shadow-sm sm:h-10 sm:w-10 ${iconBg}`}>
            {createElement(Icon, { className: 'h-4 w-4 text-white sm:h-5 sm:w-5' })}
          </div>
          <div className="ml-2 min-w-0 flex-1 sm:ml-4">
            <dl>
              <dt className="text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 sm:text-xs">{title}</dt>
              <dd className="mt-0.5 truncate text-base font-semibold text-gray-900 dark:text-white sm:text-xl" title={String(value)}>{value}</dd>
              {subValue && (
                <dd className="mt-1 line-clamp-2 text-[10px] text-gray-500 dark:text-gray-400 sm:text-xs">{subValue}</dd>
              )}
            </dl>
          </div>
        </div>
      </div>
      {change && (
        <div className="border-t border-gray-50 bg-gray-50/80 px-3 py-2 dark:border-gray-700/30 dark:bg-gray-800/50 sm:px-5 sm:py-2.5">
          <div className="text-xs sm:text-sm">
            <span
              className={`font-medium ${
                isPositive ? 'text-emerald-600 dark:text-emerald-400' : isNegative ? 'text-rose-600 dark:text-rose-400' : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              {change}
            </span>
          </div>
        </div>
      )}
    </Motion.button>
  );
};

export default StatCard;
