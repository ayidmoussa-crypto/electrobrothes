import { InfoPage, infoMetadata } from "@/components/store/InfoPage";

export const generateMetadata = ({ params }: PageProps<"/[locale]/faq">) => infoMetadata("faq", params);

export default function Page({ params }: PageProps<"/[locale]/faq">) {
  return <InfoPage slug="faq" params={params} />;
}
