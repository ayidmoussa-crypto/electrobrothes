import { InfoPage, infoMetadata } from "@/components/store/InfoPage";

export const generateMetadata = ({ params }: PageProps<"/[locale]/warranty">) => infoMetadata("warranty", params);

export default function Page({ params }: PageProps<"/[locale]/warranty">) {
  return <InfoPage slug="warranty" params={params} />;
}
