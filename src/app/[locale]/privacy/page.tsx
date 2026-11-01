import { InfoPage, infoMetadata } from "@/components/store/InfoPage";

export const generateMetadata = ({ params }: PageProps<"/[locale]/privacy">) => infoMetadata("privacy", params);

export default function Page({ params }: PageProps<"/[locale]/privacy">) {
  return <InfoPage slug="privacy" params={params} />;
}
