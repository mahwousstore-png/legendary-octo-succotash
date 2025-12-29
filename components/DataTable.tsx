import React, { useState } from 'react';
import { Search, Filter, Download, Eye, CreditCard as Edit, Trash2 } from 'lucide-react';

interface DataTableProps {
  data: any[];
}

const DataTable: React.FC<DataTableProps> = ({ data }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredData = data.filter(item => {
    const matchesSearch = JSON.stringify(item).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'all' || item.type === filterType;
    return matchesSearch && matchesFilter;
  });

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const uniqueTypes = [...new Set(data.map(item => item.type))];

  return (
    <div className="p-6 bg-page-100">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-royal-900 mb-2">إدارة البيانات</h2>
        <p className="text-royal-400">عرض وإدارة جميع البيانات المستلمة من Make.com</p>
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-white border border-beige-200 rounded-xl p-4 mb-6 shadow-luxury">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-royal-400 h-5 w-5" />
            <input
              type="text"
              placeholder="البحث في البيانات..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-4 pr-12 py-2 border border-beige-200 rounded-lg focus:ring-2 focus:ring-gold-300 focus:border-gold-500"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 border border-beige-200 rounded-lg focus:ring-2 focus:ring-gold-300 focus:border-gold-500"
            >
              <option value="all">جميع الأنواع</option>
              {uniqueTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>

            <button className="px-4 py-2 bg-gold-500 text-royal-900 font-semibold rounded-lg hover:bg-gold-400 transition-colors duration-200 flex items-center space-x-2 space-x-reverse shadow-gold">
              <Download className="h-4 w-4" />
              <span>تصدير</span>
            </button>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white border border-beige-200 rounded-xl overflow-hidden shadow-luxury">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-page-100 border-b-2 border-beige-200">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-semibold text-royal-800 uppercase tracking-wider">المعرف</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-royal-800 uppercase tracking-wider">الوقت</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-royal-800 uppercase tracking-wider">المصدر</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-royal-800 uppercase tracking-wider">النوع</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-royal-800 uppercase tracking-wider">البيانات</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-royal-800 uppercase tracking-wider">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-beige-200">
              {paginatedData.map((item, index) => (
                <tr key={item.id} className="hover:bg-gold-50/50 transition-colors duration-150">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-royal-900">
                    #{item.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-royal-600">
                    {new Date(item.timestamp).toLocaleString('en-US')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gold-100 text-gold-800">
                      {item.source}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {item.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-royal-600 max-w-xs truncate">
                    {JSON.stringify(item.data)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <button className="text-gold-600 hover:text-gold-800 p-1 rounded transition-colors duration-150">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button className="text-green-600 hover:text-green-800 p-1 rounded transition-colors duration-150">
                        <Edit className="h-4 w-4" />
                      </button>
                      <button className="text-red-600 hover:text-red-800 p-1 rounded transition-colors duration-150">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-page-100 px-6 py-3 flex items-center justify-between border-t border-beige-200">
            <div className="text-sm text-royal-700">
              عرض {(currentPage - 1) * itemsPerPage + 1} إلى {Math.min(currentPage * itemsPerPage, filteredData.length)} من {filteredData.length} نتيجة
            </div>
            <div className="flex items-center space-x-2 space-x-reverse">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border border-beige-200 rounded-md hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                السابق
              </button>

              {[...Array(Math.min(5, totalPages))].map((_, i) => {
                const pageNum = i + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-1 text-sm border rounded-md ${currentPage === pageNum
                        ? 'bg-gold-500 text-royal-900 border-gold-500'
                        : 'border-beige-200 hover:bg-white'
                      }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm border border-beige-200 rounded-md hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                التالي
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataTable;