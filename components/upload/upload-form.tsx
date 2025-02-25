'use client';

import {
  generatePdfSummary,
  generatePdfText,
  storePdfSummaryAction,
} from '@/actions/upload-actions';
import UploadFormInput from '@/components/upload/upload-form-input';
import { useToast } from '@/hooks/use-toast';
import { useUploadThing } from '@/utils/uploadthing';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { z } from 'zod';
import LoadingSkeleton from './loading-skeleton';
import { formatFileNameAsTitle } from '@/utils/format-utils';

const schema = z.object({
  file: z
    .instanceof(File, { message: 'Invalid file' })
    .refine(
      (file) => file.size <= 20 * 1024 * 1024,
      'File size must be less than 20MB'
    )
    .refine(
      (file) => file.type.startsWith('application/pdf'),
      'File must be a PDf'
    ),
});

export default function UploadForm() {
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const { startUpload, routeConfig } = useUploadThing('pdfUploader', {
    onClientUploadComplete: () => {
      console.log('uploaded successfully!');
    },
    onUploadError: (err) => {
      console.error('error occurred while uploading', err);
      toast({
        title: 'Error occurred while uploading',
        description: err.message,
      });
    },
    onUploadBegin: (data) => {
      console.log('upload has begun for', data);
    },
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      setIsLoading(true);
      const formData = new FormData(e.currentTarget);
      const file = formData.get('file') as File;

      //validating the fields
      const validatedFields = schema.safeParse({ file });

      if (!validatedFields.success) {
        toast({
          title: '❌ Something went wrong',
          variant: 'destructive',
          description:
            validatedFields.error.flatten().fieldErrors.file?.[0] ??
            'Invalid file',
        });
        setIsLoading(false);
        return;
      }

      toast({
        title: '📄 Uploading PDF...',
        description: 'We are uploading your PDF! ',
      });

      //upload the file to uploadthing

      const uploadResponse = await startUpload([file]);
      if (!uploadResponse) {
        toast({
          title: 'Something went wrong',
          description: 'Please use a different file',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      toast({
        title: '📄 Processing PDF',
        description: 'Hang tight! Our AI is reading through your document! ✨',
      });
      const uploadFileUrl = uploadResponse[0].serverData.fileUrl;

      let storeResult: any;
      toast({
        title: '📄 Saving PDF...',
        description: 'Hang tight! We are saving your summary! ✨',
      });

      const formattedFileName = formatFileNameAsTitle(file.name);

      const result = await generatePdfText({
        fileUrl: uploadFileUrl,
      });

      toast({
        title: '📄 Generating PDF Summary',
        description: 'Hang tight! Our AI is reading through your document! ✨',
      });

      //call ai service
      //parse the pdf using lang chain
      const summaryResult = await generatePdfSummary({
        pdfText: result?.data?.pdfText ?? '',
        fileName: formattedFileName,
      });

      toast({
        title: '📄 Saving PDF Summary',
        description: 'Hang tight! We are saving your summary! ✨',
      });

      const { data = null, message = null } = summaryResult || {};

      if (data?.summary) {
        //save the summary to the database
        storeResult = await storePdfSummaryAction({
          summary: data.summary,
          fileUrl: uploadFileUrl,
          title: formattedFileName,
          fileName: file.name,
        });
        // save the summary to the database
        toast({
          title: '✨ Summary Generated!',
          description: 'Your PDF has been successfully summarized and saved',
        });

        formRef.current?.reset();
        router.push(`/summaries/${storeResult.data.id}`);
      }
    } catch (error) {
      setIsLoading(false);
      console.error('Error occurred', error);
      formRef.current?.reset();
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="flex flex-col gap-8 w-full max-w-2xl mx-auto mt-2">
      <div className="relative">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-gray-200 dark:border-gray-800" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-background px-3 text-muted-foreground text-sm">
            Upload PDF
          </span>
        </div>
      </div>
      <UploadFormInput
        isLoading={isLoading}
        ref={formRef}
        onSubmit={handleSubmit}
      />
      {isLoading && (
        <>
          <div className="relative">
            <div
              className="absolute inset-0 flex items-center"
              aria-hidden="true"
            >
              <div className="w-full border-t border-gray-200 dark:border-gray-800" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-3 text-muted-foreground text-sm">
                Processing
              </span>
            </div>
          </div>
          <LoadingSkeleton />
        </>
      )}
    </div>
  );
}
