import { SearchClientPage } from '@/components/search/search-client-page';
import { SidebarProvider } from '@/components/ui/sidebar';

export default function SearchPage() {
  return (
    <SidebarProvider>
      <SearchClientPage />
    </SidebarProvider>
  );
}
