export function InvoiceContent({ order }: { order: any }) {
    return (
        <div style={{ padding: '20px' }} className="text-gray-900 dark:text-gray-100">
            <div style={{ border: '1px solid', padding: '15px', borderRadius: '5px' }} className="border-gray-200 dark:border-gray-700">
                <p style={{ margin: '5px 0' }}><strong>Order #{order.order}</strong></p>
                <p style={{ margin: '5px 0' }}><strong>ວັນທີ່:</strong> {order.created_at ? new Date(order.created_at).toLocaleString('lo-LA', { timeZone: 'Asia/Vientiane' }) : ''}</p>
                <p style={{ margin: '5px 0' }}><strong>ການຈ່າຍ:</strong> {order.pm_type}</p>
                <p style={{ margin: '5px 0' }}><strong>ຈັດສົ່ງ:</strong> <br />
                    {order.address && typeof order.address === 'object' ? (
                        Object.values(order.address)
                            .filter((line: any) => line !== null && line !== undefined && String(line).trim() !== '')
                            .map((line: any, idx: number) => (
                                <span key={idx}>- {line} <br /></span>
                            ))
                    ) : (
                        <span>{order.address}</span>
                    )}

                </p>

                <h3 style={{ margin: '15px 0 10px 0' }} className="text-gray-900 dark:text-gray-100">ລາຍການສິນຄ້າ</h3>
                <div className="overflow-x-auto" style={{ margin: '10px 0', width: '100%', maxHeight: '150px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {order.OrderItem?.map((it: any) => (
                        <div key={it.id} style={{ display: 'flex', gap: '12px', padding: '10px', borderRadius: '5px' }} className="border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                            {it.pro_id?.pro_img && (
                                <img
                                    src={it.pro_id.pro_img}
                                    alt={it.pro_id?.pro_name}
                                    style={{ minWidth: '60px', width: '60px', height: '60px', objectFit: 'cover', borderRadius: '4px' }}
                                />
                            )}
                            <div style={{ width: '10%', justifyContent: 'flex-end' }}>
                                <p style={{ margin: '0', fontSize: '14px', fontWeight: '600' }}>{it.pro_id.cate_id?.name || 'N/A'}</p>
                                <p style={{ margin: '0 0 5px 0', width: '100%', fontWeight: '600' }} className="text-gray-900 dark:text-gray-100">{it.pro_id?.pro_name}</p>
                            </div>
                            <div style={{ width: '90%', columns: 1, justifyContent: 'flex-end' }}>
                                <div className="" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', textAlign: 'right' }}>
                                    <p style={{ margin: '0', fontSize: '14px', fontWeight: '600' }}>{it.qty} *</p>
                                    <p style={{ margin: '0', fontSize: '14px', fontWeight: '600' }}>{it.price?.toLocaleString('en-US')} ₭</p>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', textAlign: 'right' }}>
                                    <p style={{ margin: '0', fontSize: '14px', fontWeight: '600' }}>=</p>
                                    <p style={{ margin: '0', fontSize: '16px', fontWeight: '600' }} className="text-[#2ecc71]">{(it.price * it.qty)?.toLocaleString('en-US')} ₭</p>
                                </div>
                            </div>

                        </div>
                    ))}
                </div>

                <div style={{ paddingTop: '10px', marginTop: '10px' }} className="border-t border-gray-200 dark:border-gray-700">
                    <p style={{ margin: '5px 0' }}><strong>ຈຳນວນລວມ:</strong> {order.total_qty} ໜ່ວຍ</p>
                    <p style={{ margin: '5px 0', fontSize: '16px' }} className="text-[#2ecc71]"><strong>ລາຄາລວມ:</strong> <span style={{ fontSize: '20px' }}>{order.sale_price?.toLocaleString('en-US')} ₭</span></p>
                </div>
            </div>
        </div>
    );
}
