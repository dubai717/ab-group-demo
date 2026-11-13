import com.healthmarketscience.jackcess.*;
import com.healthmarketscience.jackcess.complex.*;
import java.io.*;
public class MakeAccess {
 public static void main(String[] args) throws Exception {
  String root=args[0];
  Database.FileFormat[] formats=new Database.FileFormat[]{Database.FileFormat.V2000,Database.FileFormat.V2010};
  for(int i=0;i<formats.length;i++){
   String path=root+(i==0?"/customers.mdb":"/customers.accdb");
   Database db=new DatabaseBuilder(new File(path)).setFileFormat(formats[i]).create();
   TableBuilder builder=new TableBuilder("ActualCustomers").addColumn(new ColumnBuilder("ClientKey",DataType.TEXT)).addColumn(new ColumnBuilder("ClientName",DataType.TEXT)).addColumn(new ColumnBuilder("Phone",DataType.TEXT)).addColumn(new ColumnBuilder("IdentityNo",DataType.TEXT)).addColumn(new ColumnBuilder("Proof",DataType.OLE));

   builder.addIndex(new IndexBuilder("primary_key").addColumns("ClientKey").setPrimaryKey());
   Table t=builder.toTable(db);
   byte[] pdf="%PDF-1.4\n% synthetic local document\n%%EOF".getBytes("UTF-8");
   if(i==0)t.addRow(new Object[]{"71001","عميل عربي للاختبار","+971500000001","000123456789",pdf});
   else t.addRow(new Object[]{"71002","عميل مرفقات اختبار","+971500000002","000123456790",pdf});
   Table related=new TableBuilder("Vehicles").addColumn(new ColumnBuilder("ClientKey",DataType.TEXT)).addColumn(new ColumnBuilder("Plate",DataType.TEXT)).toTable(db);related.addRow(new Object[]{i==0?"71001":"71002","00123"});
   new RelationshipBuilder("ActualCustomers","Vehicles").addColumns("ClientKey","ClientKey").toRelationship(db);
   db.close();
  }
 }
}
