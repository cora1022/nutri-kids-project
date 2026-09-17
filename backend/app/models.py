from datetime import datetime
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Index, JSON, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex}"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: new_id("usr"))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    nickname: Mapped[str] = mapped_column(String(40))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    profile: Mapped["Profile | None"] = relationship(back_populates="user", uselist=False)


class Profile(Base):
    __tablename__ = "profiles"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    sex: Mapped[str] = mapped_column(String(10))
    age: Mapped[int]
    height_cm: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    weight_kg: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    meals_per_day: Mapped[int] = mapped_column(default=3)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped[User] = relationship(back_populates="profile")


class Food(Base):
    __tablename__ = "foods"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    source_type: Mapped[str] = mapped_column(String(30), index=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    brand: Mapped[str | None] = mapped_column(String(120))
    category: Mapped[str | None] = mapped_column(String(120), index=True)
    price: Mapped[int | None]
    barcode: Mapped[str | None] = mapped_column(String(32), unique=True, index=True)
    image_url: Mapped[str | None] = mapped_column(Text)
    item_report_no: Mapped[str | None] = mapped_column(String(64), index=True)
    item_report_candidates: Mapped[list[str] | None] = mapped_column(JSON)
    item_report_status: Mapped[str | None] = mapped_column(String(80))
    item_report_evidence: Mapped[str | None] = mapped_column(Text)
    serving_amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 3))
    serving_unit: Mapped[str | None] = mapped_column(String(20))
    count_unit: Mapped[str | None] = mapped_column(String(20))
    serving_label: Mapped[str | None] = mapped_column(String(100))

    nutrients: Mapped[list["FoodNutrient"]] = relationship(
        back_populates="food", cascade="all, delete-orphan"
    )
    standard_mappings: Mapped[list["ProductStandardMapping"]] = relationship(
        back_populates="food", cascade="all, delete-orphan"
    )


class FoodNutrient(Base):
    __tablename__ = "food_nutrients"

    food_id: Mapped[str] = mapped_column(ForeignKey("foods.id"), primary_key=True)
    nutrient_key: Mapped[str] = mapped_column(String(30), primary_key=True)
    value: Mapped[Decimal | None] = mapped_column(Numeric(14, 4))
    unit: Mapped[str] = mapped_column(String(20))
    quality: Mapped[str] = mapped_column(String(20))
    source: Mapped[str] = mapped_column(String(30))
    source_ref: Mapped[str | None] = mapped_column(String(100))

    food: Mapped[Food] = relationship(back_populates="nutrients")


class StandardFood(Base):
    __tablename__ = "standard_foods"

    food_code: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    food_group: Mapped[str | None] = mapped_column(String(120))
    nutrients_per_100g: Mapped[dict] = mapped_column(JSON)

    product_mappings: Mapped[list["ProductStandardMapping"]] = relationship(
        back_populates="standard_food"
    )


class ProductStandardMapping(Base):
    __tablename__ = "product_standard_mappings"
    __table_args__ = (UniqueConstraint("food_id", "standard_food_code"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    food_id: Mapped[str] = mapped_column(ForeignKey("foods.id"), index=True)
    standard_food_code: Mapped[str] = mapped_column(
        ForeignKey("standard_foods.food_code"), index=True
    )
    match_method: Mapped[str] = mapped_column(String(30))
    confidence: Mapped[Decimal] = mapped_column(Numeric(5, 4))
    review_status: Mapped[str] = mapped_column(String(20), default="PENDING")

    food: Mapped[Food] = relationship(back_populates="standard_mappings")
    standard_food: Mapped[StandardFood] = relationship(back_populates="product_mappings")


class Meal(Base):
    __tablename__ = "meals"
    __table_args__ = (
        UniqueConstraint("user_id", "client_request_id"),
        Index("ix_meals_user_eaten_at", "user_id", "eaten_at"),
    )

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: new_id("meal"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    client_request_id: Mapped[str] = mapped_column(String(64))
    meal_type: Mapped[str] = mapped_column(String(20))
    eaten_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    total_price: Mapped[int | None]
    analysis_snapshot: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    items: Mapped[list["MealItem"]] = relationship(
        back_populates="meal", cascade="all, delete-orphan"
    )


class MealItem(Base):
    __tablename__ = "meal_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    meal_id: Mapped[str] = mapped_column(ForeignKey("meals.id"), index=True)
    food_id: Mapped[str] = mapped_column(ForeignKey("foods.id"))
    food_name: Mapped[str] = mapped_column(String(255))
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 3))
    quantity_unit: Mapped[str] = mapped_column(String(20))
    resolved_amount: Mapped[dict | None] = mapped_column(JSON)
    nutrient_snapshot: Mapped[dict] = mapped_column(JSON)

    meal: Mapped[Meal] = relationship(back_populates="items")
