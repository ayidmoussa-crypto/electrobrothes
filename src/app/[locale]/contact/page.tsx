import { InfoPage, infoMetadata } from "@/components/store/InfoPage";

export const generateMetadata = ({ params }: PageProps<"/[locale]/contact">) => infoMetadata("contact", params);

export default function Page({ params }: PageProps<"/[locale]/contact">) {
  return <InfoPage slug="contact" params={params} />;
}
