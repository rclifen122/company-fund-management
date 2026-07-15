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
      <div className="p-5">
        <div className="flex items-center">
          <div className={`flex-shrink-0 w-10 h-10 bg-gradient-to-br ${iconBg} rounded-lg flex items-center justify-center shadow-sm`}>
            {createElement(Icon, { className: 'h-5 w-5 text-white' })}
          </div>
          <div className="ml-4 w-0 flex-1">
            <dl>
              <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{title}</dt>
              <dd className="text-xl font-semibold text-gray-900 dark:text-white mt-0.5">{value}</dd>
              {subValue && (
                <dd className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subValue}</dd>
              )}
            </dl>
          </div>
        </div>
      </div>
      {change && (
        <div className="bg-gray-50/80 dark:bg-gray-800/50 px-5 py-2.5 border-t border-gray-50 dark:border-gray-700/30">
          <div className="text-sm">
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
