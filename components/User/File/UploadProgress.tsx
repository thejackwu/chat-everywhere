import { cn } from '@/lib/utils';

export function UploadProgress({
  progressNumber,
  isSuccessUpload,
}: {
  progressNumber: number;
  isSuccessUpload: boolean | null;
}) {
  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-center">
        <span className="inline-block text-xs font-semibold text-white">
          {progressNumber}%
        </span>
      </div>
      <div
        className={cn(
          'overflow-hidden h-2 mb-4 text-xs flex rounded bg-[#e0e0e0]',
          isSuccessUpload === false && 'bg-red-300',
        )}
      >
        <div
          className={cn(
            'shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-black',
            isSuccessUpload === true && 'bg-green-500',
            isSuccessUpload === false && 'bg-red-500',
          )}
          style={{
            width: `${progressNumber}%`,
          }}
        />
      </div>
    </div>
  );
}
