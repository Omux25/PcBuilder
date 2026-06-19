import React, { useState } from 'react';
import styles from './FadeImage.module.css';

interface FadeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  wrapperClassName?: string;
}

export function FadeImage({ wrapperClassName = '', className = '', ...props }: FadeImageProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className={`${styles.wrapper} ${loaded ? styles.loaded : ''} ${wrapperClassName}`}>
      <img
        {...props}
        className={`${styles.image} ${className}`}
        onLoad={(e) => {
          setLoaded(true);
          if (props.onLoad) props.onLoad(e);
        }}
      />
    </div>
  );
}
