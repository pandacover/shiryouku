import { ShiryoukuLoader } from "@/components/custom/shiryouku-loader";
import { ChunkConstellation } from "@/components/dashboard/views/chunk-constellation";

export const Home = () => {
  return (
    <div className="flex h-screen flex-col">
      <div className="px-4 py-3">
        <h1>Shiryouku</h1>
      </div>
      <div className="min-h-0 flex-1">
        {/* <ChunkConstellation /> */}
        <ShiryoukuLoader pixelSize={20} />
      </div>
    </div>
  );
};
