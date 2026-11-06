import React from "react";
import { Loader2 } from "lucide-react";

const Loading = () => {
  return (
    <div className="h-screen w-screen flex items-center justify-center">
      <Loader2 className="h-12 w-12 animate-spin text-cyan-400" />
    </div>
  );
};

export default Loading;

