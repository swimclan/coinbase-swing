import React from "react";

export const renderTrendIcon = (val) => {
  switch (val) {
    case 1:
      return <span>&#8595;&#8595;</span>;
    case 2:
      return <span>&#8595;</span>;
    case 3:
      return <span>&#8594;</span>;
    case 4:
      return <span>&#8593;</span>;
    case 5:
      return <span>&#8593;&#8593;</span>;
  }
};
