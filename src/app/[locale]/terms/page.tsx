import { InfoPage, infoMetadata } from "@/components/store/InfoPage";

export const generateMetadata = ({ params }: PageProps<"/[locale]/terms">) => infoMetadata("terms", params);

export default function Page({ params }: PageProps<"/[locale]/terms">) {
  return <InfoPage slug="terms" params={params} />;
}
