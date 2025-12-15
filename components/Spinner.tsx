
import React from 'react';

interface SpinnerProps {
    size?: 'sm' | 'md' | 'lg';
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md' }) => {
    const sizeClasses = {
        sm: 'w-5 h-5 border-2',
        md: 'w-8 h-8 border-4',
        lg: 'w-12 h-12 border-4',
    };

    return (
        <div 
            className={`spinner rounded-full border-gray-200 ${sizeClasses[size]}`}
            style={{ borderTopColor: '#3498db', animation: 'spin 1s linear infinite' }}
        ></div>
    );
};
