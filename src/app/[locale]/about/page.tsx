import { InfoPage, infoMetadata } from "@/components/store/InfoPage";

export const generateMetadata = ({ params }: PageProps<"/[locale]/about">) => infoMetadata("about", params);

export default function Page({ params }: PageProps<"/[locale]/about">) {
  return <InfoPage slug="about" params={params} />;
}
